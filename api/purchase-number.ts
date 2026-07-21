import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';

function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body as Buffer | string | Record<string, unknown>;
  if (Buffer.isBuffer(raw)) {
    return JSON.parse(raw.toString('utf8'));
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  return raw as Record<string, unknown>;
}

function flagForCountry(countryCode: string): string {
  const flags: Record<string, string> = {
    US: '🇺🇸',
    GB: '🇬🇧',
    CA: '🇨🇦',
    AU: '🇦🇺',
    DE: '🇩🇪',
    FR: '🇫🇷',
    NL: '🇳🇱',
    SE: '🇸🇪',
    IE: '🇮🇪',
  };
  return flags[countryCode] || '🌐';
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

  const phoneNumber = body.phoneNumber as string | undefined;
  if (!phoneNumber) {
    res.status(400).json({ error: 'Missing phoneNumber' });
    return;
  }

  if (!TELNYX_API_KEY) {
    res.status(500).json({ error: 'Telnyx API key is not configured' });
    return;
  }

  try {
    // Step 1: Create a number order via Telnyx API
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
      console.error('Telnyx purchase error:', orderData);
      res.status(orderResponse.status).json({ error: orderData?.errors?.[0]?.detail || 'Failed to purchase number' });
      return;
    }

    const orderObj = orderData?.data as Record<string, unknown> | undefined;
    const orderPhoneNumbers = (orderObj?.phone_numbers as Array<Record<string, unknown>>) || [];
    const purchased = orderPhoneNumbers[0];

    if (!purchased) {
      res.status(500).json({ error: 'No purchase record returned from Telnyx' });
      return;
    }

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

    const monthlyCost = Number(purchased?.cost) || 1.0;
    const flag = flagForCountry(countryCode);

    // Step 2: Save the purchased number to Supabase for this user
    const { error: insertError } = await serverClient
      .from('phone_numbers')
      .insert({
        user_id: userData.user.id,
        number: purchasedNumber,
        flag,
        features,
        monthly_cost: monthlyCost,
        active: purchaseStatus === 'active',
        label: '',
      });

    if (insertError) {
      console.error('Supabase insert error after Telnyx purchase:', insertError.message);
    }

    res.status(200).json({
      success: true,
      phoneNumber: purchasedNumber,
      status: purchaseStatus,
      flag,
      features,
      monthlyCost,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Purchase number error:', error);
    res.status(500).json({ error: error.message });
  }
}
