import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addMessage } from '../lib/message-store.js';
import { supabaseServer } from '../lib/supabase-server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? '';
const LOW_BALANCE_THRESHOLD = 10;

function normalizePhone(number: string): string {
  const digits = number.replace(/\D/g, '');
  return digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+${digits}`;
}

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
    console.error('Failed to parse body:', parseErr, 'req.body type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
    res.status(400).json({ error: 'Invalid JSON body' });
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

  const { data: balanceData, error: balanceError } = await serverClient
    .from('user_balances')
    .select('tokens')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (balanceError || !balanceData || Number(balanceData.tokens) < LOW_BALANCE_THRESHOLD) {
    res.status(402).json({ error: 'Insufficient balance. Please top up your account.' });
    return;
  }

  const to = body.to as string | undefined;
  const messageBody = body.body as string | undefined;
  const rawFrom = body.from as string | undefined;
  const fromNumber = rawFrom ? normalizePhone(rawFrom) : TELNYX_PHONE_NUMBER;

  console.log('Send SMS request. to:', to, 'from:', fromNumber, 'body:', messageBody);
  if (!to || !messageBody) {
    res.status(400).json({ error: 'Missing "to" or "body"' });
    return;
  }

  if (!fromNumber) {
    res.status(400).json({ error: 'Missing sender number. Set TELNYX_PHONE_NUMBER or provide "from" in the request.' });
    return;
  }

  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to,
        text: messageBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telnyx send error:', data);
      res.status(response.status).json({ error: data?.errors?.[0]?.detail || 'Telnyx request failed' });
      return;
    }

    const message = data.data;
    const record = {
      sid: message.id,
      from: message.from?.phone_number || fromNumber,
      to: message.to?.[0]?.phone_number || to,
      body: message.text || messageBody,
      direction: 'outbound' as const,
      dateCreated: message.received_at || new Date().toISOString(),
      status: message.to?.[0]?.status || 'queued',
    };
    await addMessage(record);
    console.log('Outbound SMS sent:', record);

    res.status(200).json({ sid: message.id, status: record.status });
  } catch (err) {
    const error = err as Error;
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
