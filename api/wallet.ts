import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';

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

  const { data: wallet, error: walletError } = await serverClient
    .from('user_balances')
    .select('tokens, locked_balance, updated_at')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (walletError) {
    res.status(500).json({ error: walletError.message });
    return;
  }

  res.status(200).json({
    balance: wallet?.tokens || 0,
    lockedBalance: wallet?.locked_balance || 0,
    availableBalance: (wallet?.tokens || 0) - (wallet?.locked_balance || 0),
    updatedAt: wallet?.updated_at || null,
  });
}
