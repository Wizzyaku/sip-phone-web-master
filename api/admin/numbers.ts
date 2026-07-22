import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../../lib/supabase-server.js';

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

  const { data: numbers, error: numbersError } = await serverClient
    .from('phone_numbers')
    .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost, user_id, created_at')
    .order('created_at', { ascending: false });

  if (numbersError) {
    res.status(500).json({ error: 'Failed to fetch phone numbers.' });
    return;
  }

  const userIds = [...new Set((numbers || []).map((n) => n.user_id))];
  const { data: users } = await serverClient
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const totalNumbers = (numbers || []).length;
  const activeNumbers = (numbers || []).filter((n) => n.active).length;
  const unassignedNumbers = (numbers || []).filter((n) => !n.user_id).length;
  const pendingNumbers = (numbers || []).filter((n) => !n.active && n.user_id).length;

  const formattedNumbers = (numbers || []).map((n) => {
    const user = userMap.get(n.user_id);
    return {
      id: n.id,
      number: n.number,
      label: n.label || '',
      flag: n.flag || '🌐',
      features: n.features || [],
      active: n.active,
      forwarding: n.forwarding || null,
      voicemail: n.voicemail || false,
      monthlyCost: n.monthly_cost || 0,
      assignedUser: user ? user.name || user.email : null,
      assignedUserId: n.user_id || null,
      createdAt: n.created_at,
    };
  });

  res.status(200).json({
    totalNumbers,
    activeNumbers,
    unassignedNumbers,
    pendingNumbers,
    numbers: formattedNumbers,
  });
}
