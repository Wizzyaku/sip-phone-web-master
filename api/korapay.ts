import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, randomUUID } from 'crypto';
import { supabaseServer } from '../lib/supabase-server.js';

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY ?? '';
const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';

const TOKEN_PACKAGES = [
  { tokens: 1000, label: '1,000 tokens', priceMinor: 100000, currency: 'NGN' },
  { tokens: 5000, label: '5,000 tokens', priceMinor: 450000, currency: 'NGN' },
  { tokens: 10000, label: '10,000 tokens', priceMinor: 800000, currency: 'NGN' },
  { tokens: 20000, label: '20,000 tokens', priceMinor: 1500000, currency: 'NGN' },
];

export const config = {
  api: {
    bodyParser: false,
  },
};

function getOrigin(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-host'];
  const host = typeof forwarded === 'string' ? forwarded : req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  return `${proto}://${host}`;
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body as Buffer | string | Record<string, unknown> | undefined;
  if (!raw) return {};
  if (Buffer.isBuffer(raw)) {
    return JSON.parse(raw.toString('utf8'));
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  return raw as Record<string, unknown>;
}

async function initiateCharge(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>) {
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

  const packageIndex = Number(body.packageIndex);
  const customTokens = Number(body.customTokens);

  let tokens = 0;
  let amountMinor = 0;
  let currency = 'NGN';

  if (Number.isFinite(customTokens) && customTokens > 0) {
    tokens = Math.floor(customTokens);
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
}

async function processWebhook(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>) {
  const serverClient = supabaseServer();

  const signature = req.headers['x-korapay-signature'] as string | undefined;
  const data = body.data as Record<string, unknown> | undefined;

  if (!data) {
    res.status(400).json({ error: 'Missing data object.' });
    return;
  }

  const payload = JSON.stringify(data);
  const expected = createHmac('sha256', KORAPAY_SECRET_KEY).update(payload).digest('hex');

  if (!signature || signature !== expected) {
    console.error('Korapay webhook signature mismatch');
    res.status(401).json({ error: 'Invalid signature.' });
    return;
  }

  const event = body.event as string | undefined;
  const reference = String(data.reference || data.payment_reference || '');
  const status = String(data.status || '').toLowerCase();

  if (event !== 'charge.success' && status !== 'success') {
    res.status(200).json({ received: true, credited: false });
    return;
  }

  if (!reference) {
    res.status(400).json({ error: 'Missing transaction reference.' });
    return;
  }

  const { data: txRows, error: txError } = await serverClient
    .from('transactions')
    .select('id, user_id, tokens, status, metadata')
    .eq('reference', reference)
    .limit(1);

  if (txError) {
    console.error('Failed to lookup transaction:', txError.message);
    res.status(500).json({ error: 'Database lookup failed.' });
    return;
  }

  const transaction = (txRows || [])[0] as
    | { id: string; user_id: string; tokens: number; status: string; metadata: Record<string, unknown> | null }
    | undefined;

  if (!transaction) {
    console.error('Korapay webhook: transaction not found for reference', reference);
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }

  if (transaction.status === 'success') {
    res.status(200).json({ received: true, credited: false, reason: 'already processed' });
    return;
  }

  const metadata = transaction.metadata;
  const txType = metadata?.type as string | undefined;

  if (txType === 'number_purchase') {
    const phoneNumber = metadata?.phone_number as string;
    if (!phoneNumber) {
      console.error('Number purchase transaction missing phone_number in metadata');
      res.status(400).json({ error: 'Missing phone number in transaction metadata.' });
      return;
    }

    if (!TELNYX_API_KEY) {
      console.error('Telnyx API key not configured for number purchase');
      res.status(500).json({ error: 'Telnyx API key is not configured' });
      return;
    }

    try {
      const orderResponse = await fetch('https://api.telnyx.com/v2/number_orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_numbers: [{ phone_number: phoneNumber }],
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        console.error('Telnyx purchase error in webhook:', orderData);
        await serverClient
          .from('transactions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('reference', reference);
        res.status(200).json({
          received: true,
          purchased: false,
          error: (orderData as { errors?: { detail?: string }[] })?.errors?.[0]?.detail || 'Telnyx purchase failed',
        });
        return;
      }

      const orderObj = (orderData as { data?: Record<string, unknown> }).data;
      const orderPhoneNumbers = (orderObj?.phone_numbers as Array<Record<string, unknown>>) || [];
      const purchased = orderPhoneNumbers[0];

      if (purchased) {
        const purchasedNumber = (purchased?.phone_number as string) || phoneNumber;
        const purchaseStatus = (purchased?.status as string) || 'pending';
        const countryCode = (purchased?.country_code as string) || 'US';
        const recordFeatures = purchased?.features as string[] | undefined;

        const features: string[] = [];
        if (recordFeatures) {
          if (recordFeatures.includes('sms')) features.push('sms');
          if (recordFeatures.includes('voice')) features.push('voice');
          if (recordFeatures.includes('mms')) features.push('mms');
        } else {
          features.push('voice', 'sms');
        }

        const monthlyCost = Number(purchased?.cost) || Number(metadata?.monthly_cost) || 1.0;

        const flags: Record<string, string> = {
          US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷', NL: '🇳🇱', SE: '🇸🇪', IE: '🇮🇪',
        };
        const flag = flags[countryCode] || '🌐';

        await serverClient.from('phone_numbers').insert({
          user_id: transaction.user_id,
          number: purchasedNumber,
          flag,
          features,
          monthly_cost: monthlyCost,
          active: purchaseStatus === 'active',
          label: '',
        });
      }

      await serverClient
        .from('transactions')
        .update({ status: 'success', updated_at: new Date().toISOString() })
        .eq('reference', reference);

      res.status(200).json({ received: true, purchased: true, phoneNumber });
    } catch (purchaseErr) {
      console.error('Telnyx purchase error in webhook:', purchaseErr);
      await serverClient
        .from('transactions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('reference', reference);
      res.status(500).json({ error: 'Failed to purchase number from Telnyx.' });
    }
    return;
  }

  await serverClient.rpc('credit_tokens', {
    p_user_id: transaction.user_id,
    p_tokens: transaction.tokens,
    p_reference: reference,
  });

  res.status(200).json({ received: true, credited: true, tokens: transaction.tokens });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-korapay-signature');

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

    const body = parseBody(req);

    if (req.headers['x-korapay-signature']) {
      await processWebhook(req, res, body);
    } else if (req.headers.authorization) {
      await initiateCharge(req, res, body);
    } else {
      res.status(401).json({ error: 'Missing authorization or webhook signature.' });
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Korapay handler error:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
