import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import { NUMBER_SUBSCRIPTION_COINS } from '../lib/billing.js';

// Combined billing endpoint:
//   GET  /api/billing?action=wallet        → user wallet balance
//   GET  /api/billing?action=transactions  → paginated transaction ledger
//   POST /api/billing?action=subscription  → cron job for subscription renewal

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = (req.query.action as string) || 'wallet';
  const serverClient = supabaseServer();

  // --- Subscription check (POST, cron-only) ---
  if (action === 'subscription') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (provided !== cronSecret) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }
    }

    // Find all numbers where next_billing_date has passed
    const { data: expiredNumbers, error: fetchError } = await serverClient
      .from('phone_numbers')
      .select('id, user_id, number, billing_status, next_billing_date')
      .lt('next_billing_date', new Date().toISOString())
      .eq('billing_status', 'active');

    if (fetchError) {
      console.error('Failed to fetch expired subscriptions:', fetchError.message);
      res.status(500).json({ error: fetchError.message });
      return;
    }

    const results: Array<{ number: string; status: string }> = [];

    for (const entry of expiredNumbers || []) {
      const { data: chargeResult, error: chargeError } = await serverClient.rpc('charge_subscription', {
        p_user_id: entry.user_id,
        p_coins: NUMBER_SUBSCRIPTION_COINS,
        p_phone_number: entry.number,
      });

      if (chargeError || chargeResult !== true) {
        // Insufficient balance — suspend the number
        await serverClient
          .from('phone_numbers')
          .update({ billing_status: 'suspended', active: false })
          .eq('id', entry.id);

        results.push({ number: entry.number, status: 'suspended' });
        console.log(`Number ${entry.number} suspended due to insufficient balance`);
      } else {
        results.push({ number: entry.number, status: 'renewed' });
        console.log(`Number ${entry.number} renewed for 30 days`);
      }
    }

    res.status(200).json({ processed: results.length, results });
    return;
  }

  // --- Wallet & Transactions (GET, require auth) ---
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return;
  }

  const { data: userData, error: authError } = await serverClient.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  // --- Wallet ---
  if (action === 'wallet') {
    const { data: wallet, error: walletError } = await serverClient
      .from('user_balances')
      .select('tokens, locked_balance, updated_at')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (walletError) {
      // Fallback: select only tokens (locked_balance column may not exist)
      const { data: walletBasic, error: basicError } = await serverClient
        .from('user_balances')
        .select('tokens, updated_at')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (basicError) {
        res.status(500).json({ error: basicError.message });
        return;
      }

      res.status(200).json({
        balance: walletBasic?.tokens || 0,
        lockedBalance: 0,
        availableBalance: walletBasic?.tokens || 0,
        updatedAt: walletBasic?.updated_at || null,
      });
      return;
    }

    res.status(200).json({
      balance: wallet?.tokens || 0,
      lockedBalance: wallet?.locked_balance || 0,
      availableBalance: (wallet?.tokens || 0) - (wallet?.locked_balance || 0),
      updatedAt: wallet?.updated_at || null,
    });
    return;
  }

  // --- Transactions ---
  if (action === 'transactions') {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    let query = serverClient
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by billing_type in metadata if provided (since billing_type column may not exist)
    const billingType = req.query.type as string | undefined;
    if (billingType) {
      query = query.eq('billing_type', billingType);
    }

    const { data: transactions, error: txError, count } = await query;

    if (txError) {
      res.status(500).json({ error: txError.message });
      return;
    }

    res.status(200).json({
      transactions: transactions || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
    return;
  }

  res.status(400).json({ error: 'Unknown action. Use: wallet, transactions, or subscription.' });
}
