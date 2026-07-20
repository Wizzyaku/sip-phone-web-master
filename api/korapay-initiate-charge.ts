import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { supabaseServer } from '../lib/supabase-server.js';

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY ?? '';

const TOKEN_PACKAGES = [
  { tokens: 1000, label: '1,000 tokens', priceMinor: 100000, currency: 'NGN' },
  { tokens: 5000, label: '5,000 tokens', priceMinor: 450000, currency: 'NGN' },
  { tokens: 10000, label: '10,000 tokens', priceMinor: 800000, currency: 'NGN' },
  { tokens: 20000, label: '20,000 tokens', priceMinor: 1500000, currency: 'NGN' },
];

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
    const packageIndex = Number(body.packageIndex);
    const customTokens = Number(body.customTokens);

    let tokens = 0;
    let amountMinor = 0;
    let currency = 'NGN';

    if (Number.isFinite(customTokens) && customTokens > 0) {
      tokens = Math.floor(customTokens);
      // Default rate: 100 NGN per 100 tokens = 1 NGN per token.
      amountMinor = tokens * 100;
    } else if (
      Number.isFinite(packageIndex) &&
      packageIndex >= 0 &&
      packageIndex < TOKEN_PACKAGES.length
    ) {
      const pkg = TOKEN_PACKAGES[packageIndex];
      tokens = pkg.tokens;
      amountMinor = pkg.priceMinor;
      currency = pkg.currency;
    } else {
      res.status(400).json({ error: 'Invalid package selection.' });
      return;
    }

    const reference = `KPY${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const origin = getOrigin(req);
    const redirectUrl = `${origin}/billing?reference=${encodeURIComponent(reference)}`;
    const notificationUrl = `${origin}/api/korapay-webhook`;

    const { error: txError } = await serverClient.from('transactions').insert({
      user_id: userId,
      reference,
      tokens,
      amount_minor: amountMinor,
      currency,
      provider: 'korapay',
      status: 'pending',
    });

    if (txError) {
      console.error('Failed to create transaction:', txError.message);
      res.status(500).json({ error: 'Failed to create transaction record.' });
      return;
    }

    const korapayPayload = {
      amount: amountMinor / 100,
      currency,
      reference,
      customer: { email, name },
      redirect_url: redirectUrl,
      notification_url: notificationUrl,
      metadata: {
        userId,
        tokens: String(tokens),
      },
    };
    console.log('Korapay initialize payload:', JSON.stringify(korapayPayload));

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
        korapayData: data,
        sentPayload: korapayPayload,
      });
      return;
    }

    const checkoutUrl = (data.data as Record<string, string> | undefined)?.checkout_url;
    if (!checkoutUrl || typeof checkoutUrl !== 'string') {
      console.error('Korapay missing checkout_url:', data);
      res.status(500).json({ error: 'Korapay did not return a checkout URL.' });
      return;
    }

    res.status(200).json({ checkoutUrl, reference, tokens });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Korapay initiate-charge error:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
