import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../../lib/supabase-server.js';

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
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

  const { start: monthStart, end: monthEnd } = getMonthBounds(new Date());

  const [
    usersResult,
    numbersResult,
    revenueResult,
    pendingResult,
    logsResult,
  ] = await Promise.all([
    serverClient.from('profiles').select('*', { count: 'exact', head: true }),
    serverClient.from('phone_numbers').select('*', { count: 'exact', head: true }).eq('active', true),
    serverClient
      .from('transactions')
      .select('amount_minor, currency')
      .in('status', ['success', 'completed'])
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    serverClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    serverClient
      .from('admin_logs')
      .select('id, admin_name, admin_email, action, entity, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const totalUsers = usersResult.count ?? 0;
  const activeNumbers = numbersResult.count ?? 0;
  const pendingApprovals = pendingResult.count ?? 0;
  const revenueMinor = (revenueResult.data || []).reduce((sum, row) => sum + (row.amount_minor ?? 0), 0);
  const revenueCents = revenueMinor;
  const revenueDollars = revenueCents / 100;
  const currency = (revenueResult.data?.[0]?.currency) || 'NGN';

  const logs = (logsResult.data || []).map((log) => ({
    id: log.id,
    admin: log.admin_name || log.admin_email || 'Admin',
    initials: (log.admin_name || log.admin_email || 'A').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
    action: log.action,
    entity: log.entity || (log.entity_id ? `#${log.entity_id}` : '—'),
    timestamp: log.created_at,
    status: log.details?.status || 'success',
  }));

  res.status(200).json({
    totalUsers,
    activeNumbers,
    pendingApprovals,
    revenue: { value: revenueDollars, currency },
    recentActivity: logs,
  });
}
