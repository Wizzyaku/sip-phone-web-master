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

  const countryCode = (body.countryCode as string) || 'US';
  const searchTerm = body.search as string | undefined;

  if (!TELNYX_API_KEY) {
    res.status(500).json({ error: 'Telnyx API key is not configured' });
    return;
  }

  try {
    const url = new URL('https://api.telnyx.com/v2/available_phone_numbers');
    url.searchParams.set('filter[country_code]', countryCode);
    url.searchParams.set('filter[features]', 'sms,voice');
    url.searchParams.set('sort', 'phone_number');
    url.searchParams.set('page[size]', '20');

    if (searchTerm) {
      const digits = searchTerm.replace(/\D/g, '');
      if (digits.length >= 2) {
        url.searchParams.set('filter[phone_number][contains]', digits);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telnyx search error:', data);
      res.status(response.status).json({ error: data?.errors?.[0]?.detail || 'Telnyx request failed' });
      return;
    }

    const records = (data?.data as Array<Record<string, unknown>>) || [];

    const numbers = records.map((record, idx) => {
      const phoneNumber = (record?.phone_number as string) || '';
      const regionInfo = (record?.region_information as Array<Record<string, string>>) || [];
      const recordCountry = regionInfo.find((r) => r.region_type === 'country_code')?.region_name || countryCode;
      const costInfo = record?.cost_information as Record<string, string> | undefined;
      const upfrontCost = costInfo?.upfront_cost ? Number(costInfo.upfront_cost) : 0;
      const monthlyCost = costInfo?.monthly_cost ? Number(costInfo.monthly_cost) : 1.0;

      const features: string[] = [];
      const recordFeatures = record?.features as Array<Record<string, string>> | undefined;
      if (recordFeatures) {
        const featureNames = recordFeatures.map((f) => f.name || f);
        if (featureNames.includes('sms')) features.push('SMS');
        if (featureNames.includes('voice')) features.push('Voice');
        if (featureNames.includes('mms')) features.push('MMS');
      } else {
        features.push('Voice', 'SMS');
      }

      return {
        id: `telnyx-${idx}`,
        number: phoneNumber,
        flag: flagForCountry(recordCountry),
        features,
        upfrontCost,
        monthlyCost,
        price: monthlyCost,
      };
    });

    res.status(200).json({ numbers });
  } catch (err) {
    const error = err as Error;
    console.error('Search numbers error:', error);
    res.status(500).json({ error: error.message });
  }
}
