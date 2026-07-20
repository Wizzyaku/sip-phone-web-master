import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMessages } from '../lib/message-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const messages = await getMessages();
    console.log('Returning messages from store:', messages.length);
    res.status(200).json(messages);
  } catch (err) {
    const error = err as Error;
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
