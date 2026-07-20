import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMessages } from '../lib/message-store.js';
import { supabaseServer } from '../lib/supabase-server.js';

function normalizePhone(number: string): string {
  return number.replace(/\D/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return;
  }

  try {
    const serverClient = supabaseServer();
    const { data: userData, error: authError } = await serverClient.auth.getUser(token);
    if (authError || !userData.user) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    const userId = userData.user.id;

    const { data: phoneRows, error: phoneError } = await serverClient
      .from('phone_numbers')
      .select('number')
      .eq('user_id', userId);

    if (phoneError) {
      console.error('Failed to fetch phone numbers:', phoneError);
      res.status(500).json({ error: 'Failed to fetch user phone numbers.' });
      return;
    }

    const userNumbers = (phoneRows || []).map((row: { number: string }) => normalizePhone(row.number));

    if (userNumbers.length === 0) {
      res.status(200).json([]);
      return;
    }

    const allMessages = await getMessages();
    const filtered = allMessages.filter((m) => {
      const fromNorm = normalizePhone(m.from);
      const toNorm = normalizePhone(m.to);
      return userNumbers.includes(fromNorm) || userNumbers.includes(toNorm);
    });

    console.log(`Returning ${filtered.length} messages for user ${userId} (out of ${allMessages.length} total)`);
    res.status(200).json(filtered);
  } catch (err) {
    const error = err as Error;
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
