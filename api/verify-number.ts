import type { VercelRequest, VercelResponse } from '@vercel/node';

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

function normalizePhone(number: string): string {
  const digits = number.replace(/\D/g, '');
  return digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+${digits}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = parseJsonBody(req);
  } catch (parseErr) {
    console.error('Failed to parse body:', parseErr);
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const rawNumber = body.phoneNumber as string | undefined;
  if (!rawNumber) {
    res.status(400).json({ error: 'Missing phoneNumber' });
    return;
  }

  const phoneNumber = normalizePhone(rawNumber);

  if (!TELNYX_API_KEY) {
    res.status(500).json({ error: 'Telnyx API key is not configured' });
    return;
  }

  try {
    const url = new URL('https://api.telnyx.com/v2/phone_numbers');
    url.searchParams.set('filter[phone_number]', phoneNumber);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telnyx verify error:', data);
      res.status(response.status).json({ error: data?.errors?.[0]?.detail || 'Telnyx request failed' });
      return;
    }

    const records = (data?.data as Array<Record<string, unknown>>) || [];
    const match = records.find((record) => {
      const recordNumber = (record?.phone_number as string) || '';
      return normalizePhone(recordNumber) === phoneNumber;
    });

    if (!match) {
      res.status(404).json({ error: `Phone number ${phoneNumber} is not active on this Telnyx account.` });
      return;
    }

    const status = (match?.status as string) || 'active';
    const messagingProfileId = (match?.messaging_profile_id as string) || null;

    if (status !== 'active' && status !== 'pending') {
      res.status(400).json({ error: `Phone number ${phoneNumber} is not active (status: ${status}).` });
      return;
    }

    res.status(200).json({
      valid: true,
      phoneNumber,
      messagingProfileId,
      status,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Verify number error:', error);
    res.status(500).json({ error: error.message });
  }
}
