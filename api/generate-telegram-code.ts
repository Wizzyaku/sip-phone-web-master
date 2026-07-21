import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import { getTelegramUsername } from '../lib/telegram.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LINK-${code.slice(0, 4)}-${code.slice(4)}`;
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

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await serverClient
    .from('profiles')
    .update({
      telegram_code: code,
      telegram_code_expires_at: expiresAt,
    })
    .eq('id', userData.user.id);

  if (error) {
    console.error('[Telegram] Failed to save code:', error);
    res.status(500).json({ error: 'Failed to generate code.' });
    return;
  }

  const botUsername = await getTelegramUsername();
  const link = botUsername
    ? `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`
    : undefined;

  res.status(200).json({ code, link, expiresAt });
}
