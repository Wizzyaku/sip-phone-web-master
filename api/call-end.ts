import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import { calculateCallCost } from '../lib/billing.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body as Buffer | string | Record<string, unknown>;
  if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString('utf8'));
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return;
  }

  const serverClient = supabaseServer();
  const { data: userData, error: authError } = await serverClient.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = parseJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const callId = body.callId as string | undefined;
  const durationSeconds = Number(body.durationSeconds) || 0;
  const direction = (body.direction as string) || 'outgoing';
  const reservedCoins = Number(body.reservedCoins) || 0;
  const recorded = Boolean(body.recorded);
  const remoteIdentity = (body.remoteIdentity as string) || '';

  // Calculate actual call cost
  const actualCost = calculateCallCost(
    durationSeconds,
    direction === 'incoming' ? 'incoming' : 'outgoing'
  );

  // Add recording cost if call was recorded
  let recordingCost = 0;
  if (recorded) {
    const recordingMinutes = Math.ceil(durationSeconds / 60);
    recordingCost = recordingMinutes * 6; // 6 coins per minute
  }

  const totalCost = actualCost + recordingCost;

  // --- FALLBACK PATH: No callId means call-start failed ---
  // Create a call log now and charge directly via debit_tokens
  if (!callId) {
    console.log('[Billing] Fallback: no callId, creating call log and charging directly');

    // Create call log (only original schema columns)
    const { data: newLog } = await serverClient
      .from('call_logs')
      .insert({
        user_id: userData.user.id,
        remote_identity: remoteIdentity,
        direction,
        type: direction,
        duration_seconds: durationSeconds,
        recorded,
      })
      .select('id')
      .single();

    // Charge directly via debit_tokens
    const { data: debitResult, error: debitError } = await serverClient.rpc('debit_tokens', {
      p_user_id: userData.user.id,
      p_tokens: totalCost,
      p_reference: `CALL-FB-${newLog?.id || Date.now()}`,
    });

    if (debitError) {
      console.error('[Billing] Fallback debit error:', debitError.message);
    } else if (debitResult === true) {
      // Log the transaction (omit billing_type/billing_direction in case columns don't exist yet)
      await serverClient.from('transactions').insert({
        user_id: userData.user.id,
        reference: `CALL-FB-${newLog?.id || Date.now()}`,
        tokens: totalCost,
        amount_minor: 0,
        currency: 'COINS',
        provider: 'billing',
        status: 'success',
        metadata: {
          billing_type: 'call',
          billing_direction: 'debit',
          call_id: newLog?.id || null,
          direction,
          duration_seconds: durationSeconds,
          cost_coins: totalCost,
          fallback: true,
        },
      });
      console.log(`[Billing] Fallback charged ${totalCost} coins for call`);
    } else {
      console.warn(`[Billing] Fallback: insufficient balance (${totalCost} coins needed)`);
    }

    res.status(200).json({
      callId: newLog?.id || null,
      durationSeconds,
      actualCost,
      recordingCost,
      totalCost,
      refundCoins: 0,
      status: 'settled',
      fallback: true,
    });
    return;
  }

  // --- NORMAL PATH: callId exists from call-start ---

  // Settle the call: deduct exact cost from locked balance, refund remainder
  const { data: refundAmount, error: settleError } = await serverClient.rpc('settle_call', {
    p_user_id: userData.user.id,
    p_locked_amount: reservedCoins,
    p_actual_cost: totalCost,
    p_call_id: callId,
    p_direction: direction,
    p_duration_seconds: durationSeconds,
  });

  if (settleError) {
    console.error('Settle call error:', settleError.message);
    // Fallback: try direct debit if settle_call fails (e.g. RPC not deployed)
    console.log('[Billing] settle_call failed, trying direct debit fallback');
    const { data: debitResult } = await serverClient.rpc('debit_tokens', {
      p_user_id: userData.user.id,
      p_tokens: totalCost,
      p_reference: `CALL-FB-${callId}`,
    });

    if (debitResult === true) {
      await serverClient.from('transactions').insert({
        user_id: userData.user.id,
        reference: `CALL-FB-${callId}`,
        tokens: totalCost,
        amount_minor: 0,
        currency: 'COINS',
        provider: 'billing',
        status: 'success',
        metadata: {
          billing_type: 'call',
          billing_direction: 'debit',
          call_id: callId,
          direction,
          duration_seconds: durationSeconds,
          cost_coins: totalCost,
          fallback: true,
        },
      });
    }

    // Still try to update the call log (only original columns + duration)
    await serverClient
      .from('call_logs')
      .update({
        duration_seconds: durationSeconds,
        recorded,
      })
      .eq('id', callId)
      .eq('user_id', userData.user.id);

    res.status(200).json({
      callId,
      durationSeconds,
      actualCost,
      recordingCost,
      totalCost,
      refundCoins: 0,
      status: 'settled',
      fallback: true,
    });
    return;
  }

  // Update call log with final duration (only original schema columns)
  await serverClient
    .from('call_logs')
    .update({
      duration_seconds: durationSeconds,
      recorded,
    })
    .eq('id', callId)
    .eq('user_id', userData.user.id);

  // If recording was enabled, charge for it separately
  if (recorded && recordingCost > 0) {
    await serverClient.rpc('charge_feature', {
      p_user_id: userData.user.id,
      p_coins: recordingCost,
      p_feature_type: 'recording',
      p_metadata: { call_id: callId, duration_seconds: durationSeconds },
    });
  }

  res.status(200).json({
    callId,
    durationSeconds,
    actualCost,
    recordingCost,
    totalCost,
    refundCoins: refundAmount,
    status: 'settled',
  });
}
