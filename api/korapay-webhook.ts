import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { supabaseServer } from '../lib/supabase-server.js';

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY ?? '';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseBody(req: VercelRequest): Record<string, unknown> {
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-korapay-signature');

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

    let body: Record<string, unknown>;
    try {
      body = parseBody(req);
    } catch (parseErr) {
      console.error('Failed to parse webhook body:', parseErr);
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

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

    // Lookup the pending transaction to get the user and token amount.
    const { data: txRows, error: txError } = await serverClient
      .from('transactions')
      .select('id, user_id, tokens, status')
      .eq('reference', reference)
      .limit(1);

  if (txError) {
    console.error('Failed to lookup transaction:', txError.message);
    res.status(500).json({ error: 'Database lookup failed.' });
    return;
  }

  const transaction = (txRows || [])[0] as { id: string; user_id: string; tokens: number; status: string } | undefined;
  if (!transaction) {
    console.error('Korapay webhook: transaction not found for reference', reference);
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }

    if (transaction.status === 'success') {
      res.status(200).json({ received: true, credited: false, reason: 'already processed' });
      return;
    }

    await serverClient.rpc('credit_tokens', {
      p_user_id: transaction.user_id,
      p_tokens: transaction.tokens,
      p_reference: reference,
    });

    res.status(200).json({ received: true, credited: true, tokens: transaction.tokens });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Korapay webhook error:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
