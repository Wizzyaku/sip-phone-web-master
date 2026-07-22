import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../../lib/supabase-server.js';
import { getMessages } from '../../lib/message-store.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const serverClient = supabaseServer();
  const { data: userData, error: authError } = await serverClient.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  const { data: profile } = await serverClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  const allMessages = await getMessages();

  const total = allMessages.length;
  const inbound = allMessages.filter((m) => m.direction === 'inbound').length;
  const outbound = allMessages.filter((m) => m.direction === 'outbound').length;
  const failed = allMessages.filter(
    (m) => {
      const s = (m.status || '').toLowerCase();
      return s === 'failed' || s === 'error' || s === 'undelivered';
    }
  ).length;

  const messages = allMessages
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
    .slice(0, 200)
    .map((m) => ({
      sid: m.sid,
      from: m.from,
      to: m.to,
      body: m.body,
      direction: m.direction,
      status: m.status,
      dateCreated: m.dateCreated,
    }));

  res.status(200).json({
    total,
    inbound,
    outbound,
    failed,
    messages,
  });
}
