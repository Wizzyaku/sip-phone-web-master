import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import {
  calculateReserveAmount,
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

  const direction = (body.direction as string) || 'outgoing';
  const remoteIdentity = (body.remoteIdentity as string) || '';

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
  // If the RPC doesn't exist yet (schema not applied), we still proceed —
  // the call-end endpoint will charge directly via debit_tokens as fallback
  let reservedCoins = 0;
  try {
    const { data: reserveResult, error: reserveError } = await serverClient.rpc('reserve_coins', {
      p_user_id: userData.user.id,
      p_coins: reserveAmount,
    });

    if (reserveError) {
      console.warn('[Billing] reserve_coins RPC failed (schema may not be applied):', reserveError.message);
      // Don't fail — proceed without reserving, fallback at call-end
    } else if (reserveResult === true) {
      reservedCoins = reserveAmount;
      console.log('[Billing] Reserved', reserveAmount, 'coins for call');
    } else {
      // Insufficient balance even for 60s reserve — still proceed, will charge at end
      console.warn('[Billing] Insufficient balance for reserve, proceeding without lock');
    }
  } catch (reserveErr) {
    console.warn('[Billing] reserve_coins error, proceeding without lock:', reserveErr);
  }

  // Create a call log entry (always, even if reserve failed)
  // Only use columns that existed in the original schema — cost_coins/status
  // are added in the new schema migration but may not be applied yet
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
}
