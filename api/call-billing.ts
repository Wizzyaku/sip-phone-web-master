import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import {
  calculateReserveAmount,
  calculateCallCost,
  MIN_CALL_BALANCE,
} from '../lib/billing.js';

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

  const action = (body.action as string) || 'start';
  const direction = (body.direction as string) || 'outgoing';
  const remoteIdentity = (body.remoteIdentity as string) || '';

  // ============================================================
  // ACTION: start — reserve coins and create call log
  // ============================================================
  if (action === 'start') {
    // Check minimum balance threshold
    const { data: balanceData } = await serverClient
      .from('user_balances')
      .select('tokens')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!balanceData || Number(balanceData.tokens) < MIN_CALL_BALANCE) {
      res.status(402).json({
        error: `Insufficient balance. You need at least ${MIN_CALL_BALANCE} coins to start a call.`,
        minRequired: MIN_CALL_BALANCE,
      });
      return;
    }

    // Calculate reserve amount (60 seconds worth)
    const reserveAmount = calculateReserveAmount(
      direction === 'incoming' ? 'incoming' : 'outgoing'
    );

    // Try to reserve coins (move from tokens to locked_balance)
    let reservedCoins = 0;
    try {
      const { data: reserveResult, error: reserveError } = await serverClient.rpc('reserve_coins', {
        p_user_id: userData.user.id,
        p_coins: reserveAmount,
      });

      if (reserveError) {
        console.warn('[Billing] reserve_coins RPC failed (schema may not be applied):', reserveError.message);
      } else if (reserveResult === true) {
        reservedCoins = reserveAmount;
        console.log('[Billing] Reserved', reserveAmount, 'coins for call');
      } else {
        console.warn('[Billing] Insufficient balance for reserve, proceeding without lock');
      }
    } catch (reserveErr) {
      console.warn('[Billing] reserve_coins error, proceeding without lock:', reserveErr);
    }

    // Create a call log entry
    const { data: callLog, error: logError } = await serverClient
      .from('call_logs')
      .insert({
        user_id: userData.user.id,
        remote_identity: remoteIdentity,
        direction,
        type: direction,
        duration_seconds: 0,
        recorded: false,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Call log insert error:', logError.message);
    }

    res.status(200).json({
      callId: callLog?.id || null,
      reservedCoins,
      status: reservedCoins > 0 ? 'reserved' : 'pending',
    });
    return;
  }

  // ============================================================
  // ACTION: end — settle call billing
  // ============================================================
  if (action === 'end') {
    const callId = body.callId as string | undefined;
    const durationSeconds = Number(body.durationSeconds) || 0;
    const reservedCoins = Number(body.reservedCoins) || 0;
    const recorded = Boolean(body.recorded);

    // Calculate actual call cost
    const actualCost = calculateCallCost(
      durationSeconds,
      direction === 'incoming' ? 'incoming' : 'outgoing'
    );

    // Add recording cost if call was recorded
    let recordingCost = 0;
    if (recorded) {
      const recordingMinutes = Math.ceil(durationSeconds / 60);
      recordingCost = recordingMinutes * 6;
    }

    const totalCost = actualCost + recordingCost;

    // --- FALLBACK PATH: No callId means call-start failed ---
    if (!callId) {
      console.log('[Billing] Fallback: no callId, creating call log and charging directly');

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

      const { data: debitResult, error: debitError } = await serverClient.rpc('debit_tokens', {
        p_user_id: userData.user.id,
        p_tokens: totalCost,
        p_reference: `CALL-FB-${newLog?.id || Date.now()}`,
      });

      if (debitError) {
        console.error('[Billing] Fallback debit error:', debitError.message);
      } else if (debitResult === true) {
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

    // Update call log with final duration
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
    return;
  }

  res.status(400).json({ error: 'Unknown action. Use: start or end.' });
}
