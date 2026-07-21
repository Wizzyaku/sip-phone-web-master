import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { supabaseServer } from '../lib/supabase-server.js';

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY ?? '';
const TOKENS_PER_USD = 1000;

function getOrigin(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-host'];
  const host = typeof forwarded === 'string' ? forwarded : req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  return `${proto}://${host}`;
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

  try {
    if (!KORAPAY_SECRET_KEY) {
      res.status(503).json({ error: 'Korapay is not configured on this server.' });
      return;
    }

    const serverClient = supabaseServer();

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

    const userId = userData.user.id;
    const email = userData.user.email || '';
    const name =
      (userData.user.user_metadata?.full_name as string | undefined) ||
      (userData.user.user_metadata?.name as string | undefined) ||
      email.split('@')[0] ||
      'Customer';

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const phoneNumber = body.phoneNumber as string | undefined;
    const upfrontCost = Number(body.upfrontCost) || 0;
    const monthlyCost = Number(body.monthlyCost) || 0;

    if (!phoneNumber) {
      res.status(400).json({ error: 'Missing phoneNumber' });
      return;
    }

    // Calculate total cost: upfront + first month, in USD
    const totalCostUSD = upfrontCost + monthlyCost;
    // Convert to tokens (1000 tokens = $1), then to NGN (1 NGN = 1 token)
    const totalTokens = Math.ceil(totalCostUSD * TOKENS_PER_USD);
    const amountNGN = totalTokens; // 1 NGN per token
    const amountMinor = amountNGN * 100; // kobo

    const reference = `NUM${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const origin = getOrigin(req);
    const redirectUrl = `${origin}/phone-numbers?reference=${encodeURIComponent(reference)}`;
    const notificationUrl = `${origin}/api/korapay-webhook`;

    // Create a pending transaction with number purchase metadata
    const { error: txError } = await serverClient.from('transactions').insert({
      user_id: userId,
      reference,
      tokens: 0, // No tokens credited — this is a number purchase
      amount_minor: amountMinor,
      currency: 'NGN',
      provider: 'korapay',
      status: 'pending',
      metadata: {
        type: 'number_purchase',
        phone_number: phoneNumber,
        upfront_cost: upfrontCost,
        monthly_cost: monthlyCost,
        tokens_equivalent: totalTokens,
      },
    });

    if (txError) {
      console.error('Failed to create transaction:', txError.message);
      res.status(500).json({ error: 'Failed to create transaction record.' });
      return;
    }

    const korapayPayload = {
      amount: amountMinor / 100,
      currency: 'NGN',
      reference,
      customer: { email, name },
      redirect_url: redirectUrl,
      notification_url: notificationUrl,
      metadata: {
        userId,
        type: 'number_purchase',
        phoneNumber,
      },
    };

    const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(korapayPayload),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      console.error('Korapay initialize error:', data);
      const korapayMessage = String(data.message || data.error || JSON.stringify(data));
      res.status(response.status).json({
        error: 'Korapay charge initialization failed.',
        korapayMessage,
      });
      return;
    }

    const checkoutUrl = (data.data as Record<string, string> | undefined)?.checkout_url;
    if (!checkoutUrl || typeof checkoutUrl !== 'string') {
      console.error('Korapay missing checkout_url:', data);
      res.status(500).json({ error: 'Korapay did not return a checkout URL.' });
      return;
    }

    res.status(200).json({ checkoutUrl, reference, phoneNumber });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Initiate number purchase error:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
