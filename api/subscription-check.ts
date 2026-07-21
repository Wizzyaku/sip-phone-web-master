import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import { NUMBER_SUBSCRIPTION_COINS } from '../lib/billing.js';

// This endpoint should be called daily by a cron job (e.g. Vercel Cron, GitHub Actions, etc.)
// It checks all phone numbers with expired next_billing_date and attempts to charge 5000 coins.
// If charge fails, the number is suspended (billing_status = 'suspended', active = false).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Optional: verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (provided !== cronSecret) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  }

  const serverClient = supabaseServer();

  // Find all numbers where next_billing_date has passed and billing_status is still 'active'
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
    // Attempt to charge subscription
    const { data: chargeResult, error: chargeError } = await serverClient.rpc('charge_subscription', {
      p_user_id: entry.user_id,
      p_coins: NUMBER_SUBSCRIPTION_COINS,
      p_phone_number: entry.number,
    });

    if (chargeError || chargeResult !== true) {
      // Insufficient balance — suspend the number
      await serverClient
        .from('phone_numbers')
        .update({
          billing_status: 'suspended',
          active: false,
        })
        .eq('id', entry.id);

      results.push({ number: entry.number, status: 'suspended' });
      console.log(`Number ${entry.number} suspended due to insufficient balance`);
    } else {
      results.push({ number: entry.number, status: 'renewed' });
      console.log(`Number ${entry.number} renewed for 30 days`);
    }
  }

  res.status(200).json({
    processed: results.length,
    results,
  });
}
