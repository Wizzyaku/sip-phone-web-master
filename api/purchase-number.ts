import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import { NUMBER_SUBSCRIPTION_COINS } from '../lib/billing.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';
const TOKENS_PER_USD = 1000;

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
  const upfrontCost = Number(body.upfrontCost) || 0;
  const monthlyCost = Number(body.monthlyCost) || 0;
  if (!phoneNumber) {
    res.status(400).json({ error: 'Missing phoneNumber' });
    return;
  }

  if (!TELNYX_API_KEY) {
    res.status(500).json({ error: 'Telnyx API key is not configured' });
    return;
  }

  // Calculate cost: flat 5000 coins subscription for 30 days
  const totalTokensNeeded = NUMBER_SUBSCRIPTION_COINS;

  // Step 1: Check and debit user's token balance
  const { data: debitResult, error: debitError } = await serverClient.rpc('debit_tokens', {
    p_user_id: userData.user.id,
    p_tokens: totalTokensNeeded,
    p_reference: `NUM-${phoneNumber}-${Date.now()}`,
  });

  if (debitError) {
    console.error('Debit tokens error:', debitError.message);
    res.status(500).json({ error: 'Failed to process payment. Please try again.' });
    return;
  }

  if (debitResult !== true) {
    res.status(402).json({
      error: `Insufficient token balance. You need ${totalTokensNeeded} coins to purchase this number.`,
      tokensNeeded: totalTokensNeeded,
    });
    return;
  }

  try {
    // Step 2: Purchase the number from Telnyx using admin balance
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
      // Refund tokens since Telnyx purchase failed
      await serverClient.rpc('credit_tokens', {
        p_user_id: userData.user.id,
        p_tokens: totalTokensNeeded,
        p_reference: `REFUND-${phoneNumber}-${Date.now()}`,
      });
      res.status(orderResponse.status).json({
        error: orderData?.errors?.[0]?.detail || 'Failed to purchase number. Your tokens have been refunded.',
      });
      return;
    }

    const orderObj = orderData?.data as Record<string, unknown> | undefined;
    const orderPhoneNumbers = (orderObj?.phone_numbers as Array<Record<string, unknown>>) || [];
    const purchased = orderPhoneNumbers[0];

    if (!purchased) {
      // Refund tokens
      await serverClient.rpc('credit_tokens', {
        p_user_id: userData.user.id,
        p_tokens: totalTokensNeeded,
        p_reference: `REFUND-${phoneNumber}-${Date.now()}`,
      });
      res.status(500).json({ error: 'No purchase record returned from Telnyx. Tokens refunded.' });
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

    const actualMonthlyCost = Number(purchased?.cost) || monthlyCost || 1.0;
    const flag = flagForCountry(countryCode);

    // Step 2.5: Assign the number to a messaging profile for SMS capability
    try {
      let profileId: string | null = null;
      const listRes = await fetch('https://api.telnyx.com/v2/messaging_profiles?page[size]=1', {
        headers: { Authorization: `Bearer ${TELNYX_API_KEY}` },
      });
      const listData = await listRes.json();
      const existing = listData?.data?.[0];
      if (existing?.id) {
        profileId = existing.id as string;
      } else {
        const createRes = await fetch('https://api.telnyx.com/v2/messaging_profiles', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Default Messaging Profile',
            whitelisted_destinations: ['US', 'CA', 'GB'],
          }),
        });
        const createData = await createRes.json();
        profileId = createData?.data?.id || null;
      }
      if (profileId) {
        await fetch(`https://api.telnyx.com/v2/messaging_phone_numbers/${purchasedNumber}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_profile_id: profileId }),
        });
        console.log('[Telnyx] Assigned', purchasedNumber, 'to messaging profile', profileId);
      }
    } catch (profileErr) {
      console.warn('[Telnyx] Failed to assign messaging profile (non-fatal):', profileErr);
    }

    // Step 3: Save the purchased number to Supabase for this user
    // next_billing_date and billing_status are in the new schema but may not be applied yet
    const { error: insertError } = await serverClient
      .from('phone_numbers')
      .insert({
        user_id: userData.user.id,
        number: purchasedNumber,
        flag,
        features,
        monthly_cost: actualMonthlyCost,
        active: purchaseStatus === 'active',
        label: '',
      });

    if (insertError) {
      console.error('Supabase insert error after Telnyx purchase:', insertError.message);
    }

    // Step 4: Record the transaction
    await serverClient.from('transactions').insert({
      user_id: userData.user.id,
      reference: `NUM-${phoneNumber}-${Date.now()}`,
      tokens: -totalTokensNeeded,
      amount_minor: 0,
      currency: 'COINS',
      provider: 'balance',
      status: 'success',
      metadata: {
        billing_type: 'subscription',
        billing_direction: 'debit',
        type: 'number_purchase',
        phone_number: purchasedNumber,
        monthly_cost: actualMonthlyCost,
        subscription_coins: totalTokensNeeded,
      },
    });

    res.status(200).json({
      success: true,
      phoneNumber: purchasedNumber,
      status: purchaseStatus,
      flag,
      features,
      monthlyCost: actualMonthlyCost,
      tokensSpent: totalTokensNeeded,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Purchase number error:', error);
    // Refund tokens on unexpected error
    await serverClient.rpc('credit_tokens', {
      p_user_id: userData.user.id,
      p_tokens: totalTokensNeeded,
      p_reference: `REFUND-${phoneNumber}-${Date.now()}`,
    });
    res.status(500).json({ error: error.message + ' Your tokens have been refunded.' });
  }
}
