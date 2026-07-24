import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../../lib/supabase-server.js';
import { getMessages } from '../../lib/message-store.js';
import {
  SMS_COINS_PER_SEGMENT,
  MMS_COINS_PER_MESSAGE,
  NUMBER_SUBSCRIPTION_COINS,
  OUTBOUND_CALL_COINS_PER_SECOND,
  INBOUND_CALL_COINS_PER_SECOND,
  CALL_RECORDING_COINS_PER_MINUTE,
  COINS_PER_USD,
} from '../../lib/billing.js';

export const config = {
  api: {
    bodyParser: true,
  },
};

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function verifyAdmin(req: VercelRequest, res: VercelResponse) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return null;
  }

  const serverClient = supabaseServer();
  const { data: userData, error: authError } = await serverClient.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return null;
  }

  const { data: profile } = await serverClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return null;
  }

  return serverClient;
}

async function handleOverview(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  const { start: monthStart, end: monthEnd } = getMonthBounds(new Date());

  const [usersResult, numbersResult, revenueResult, pendingResult, logsResult] = await Promise.all([
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
      .select('id, admin_name, admin_email, action, entity, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const totalUsers = usersResult.count ?? 0;
  const activeNumbers = numbersResult.count ?? 0;
  const pendingApprovals = pendingResult.count ?? 0;
  const revenueMinor = (revenueResult.data || []).reduce((sum, row) => sum + (row.amount_minor ?? 0), 0);
  const revenueDollars = revenueMinor / 100;
  const currency = revenueResult.data?.[0]?.currency || 'NGN';

  const logs = (logsResult.data || []).map((log) => ({
    id: log.id,
    admin: log.admin_name || log.admin_email || 'Admin',
    initials: (log.admin_name || log.admin_email || 'A').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase(),
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

async function handleNumbers(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  const { data: numbers, error: numbersError } = await serverClient
    .from('phone_numbers')
    .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (numbersError) {
    res.status(500).json({ error: 'Failed to fetch phone numbers.' });
    return;
  }

  const { count: dbCount } = await serverClient
    .from('phone_numbers')
    .select('*', { count: 'exact', head: true });

  console.log('[admin/numbers] DB count:', dbCount, 'Rows returned:', (numbers || []).length);

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

async function handleUsers(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  // 1. Fetch ALL users from auth.users via Admin API (paginated)
  const authUsers: Array<{ id: string; email: string; created_at: string }> = [];
  let page = 1;
  const perPage = 1000;
  try {
    while (true) {
      const { data, error } = await serverClient.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.warn('[admin/users] auth.admin.listUsers failed:', error.message);
        break;
      }
      const batch = (data.users || []) as Array<{ id: string; email?: string; created_at?: string }>;
      for (const u of batch) {
        authUsers.push({ id: u.id, email: u.email || '', created_at: u.created_at || '' });
      }
      if (batch.length < perPage) break;
      page++;
      if (page > 10) break; // safety limit
    }
  } catch (e) {
    console.warn('[admin/users] auth.admin.listUsers exception:', (e as Error).message);
  }

  // 2. Fetch profiles for role/name/avatar/telegram
  const profileMap = new Map<string, Record<string, unknown>>();
  try {
    const { data: profiles } = await serverClient.from('profiles').select('*');
    (profiles || []).forEach((p) => profileMap.set(p.id, p));
  } catch (e) {
    console.warn('[admin/users] profiles query failed:', (e as Error).message);
  }

  // 3. Merge: use auth.users as primary source, profiles as supplementary
  const userIds = authUsers.map((u) => u.id);
  const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

  let balanceMap = new Map<string, number>();
  let userNumbersMap = new Map<string, { id: string; number: string; label: string; active: boolean }[]>();
  let activeEmails = new Set<string>();

  try {
    const { data: balances } = await serverClient
      .from('user_balances')
      .select('id, tokens')
      .in('id', safeIds);
    balanceMap = new Map((balances || []).map((b) => [b.id, b.tokens || 0]));
  } catch (e) {
    console.warn('[admin/users] user_balances query failed:', (e as Error).message);
  }

  try {
    const { data: numbers } = await serverClient
      .from('phone_numbers')
      .select('id, number, label, active, user_id')
      .in('user_id', safeIds);
    (numbers || []).forEach((n) => {
      const uid = n.user_id;
      if (!userNumbersMap.has(uid)) userNumbersMap.set(uid, []);
      userNumbersMap.get(uid)!.push({
        id: n.id,
        number: n.number,
        label: n.label || '',
        active: n.active,
      });
    });
  } catch (e) {
    console.warn('[admin/users] phone_numbers query failed:', (e as Error).message);
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await serverClient
      .from('admin_logs')
      .select('admin_email, created_at')
      .gte('created_at', thirtyDaysAgo);
    activeEmails = new Set((logs || []).map((s) => s.admin_email));
  } catch (e) {
    console.warn('[admin/users] admin_logs query failed:', (e as Error).message);
  }

  const users = authUsers.map((u) => {
    const profile = profileMap.get(u.id) as Record<string, unknown> | undefined;
    const userNumbers = userNumbersMap.get(u.id) || [];
    const email = u.email || (profile?.email as string) || '';
    return {
      id: u.id,
      name: (profile?.name as string) || email.split('@')[0] || 'User',
      email,
      avatar: (profile?.avatar as string) || '',
      phoneNumber: userNumbers[0]?.number || null,
      role: (profile?.role as string) || 'user',
      createdAt: u.created_at || null,
      tokenBalance: balanceMap.get(u.id) || 0,
      assignedNumbers: userNumbers.length,
      numbers: userNumbers,
      telegram: (profile?.telegram_username as string) || (profile?.telegram_id as string) || null,
      telegramChatId: (profile?.telegram_chat_id as string) || null,
    };
  });

  const total = users.length;
  const admins = users.filter((u) => u.role === 'admin').length;
  const suspended = 0;
  const active = users.filter((u) => activeEmails.has(u.email)).length;

  res.status(200).json({ total, active, admins, suspended, users });
}

async function handleCalls(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  const { data: calls, error: callsError } = await serverClient
    .from('call_logs')
    .select('id, user_id, remote_identity, direction, duration_seconds, recorded, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (callsError) {
    res.status(500).json({ error: 'Failed to fetch call logs.' });
    return;
  }

  const userIds = [...new Set((calls || []).map((c) => c.user_id))];
  const { data: users } = await serverClient
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const total = (calls || []).length;
  const inbound = (calls || []).filter((c) => c.direction === 'incoming').length;
  const outbound = (calls || []).filter((c) => c.direction === 'outgoing').length;
  const totalDuration = (calls || []).reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  const formattedCalls = (calls || []).map((c) => {
    const user = userMap.get(c.user_id);
    return {
      id: c.id,
      from: c.direction === 'incoming' ? c.remote_identity : 'user',
      to: c.direction === 'outgoing' ? c.remote_identity : 'user',
      remoteIdentity: c.remote_identity || '',
      direction: c.direction === 'incoming' ? 'inbound' : 'outbound',
      durationSeconds: c.duration_seconds || 0,
      recorded: c.recorded || false,
      createdAt: c.created_at,
      user: user ? user.name || user.email : null,
    };
  });

  res.status(200).json({ total, inbound, outbound, totalDuration, calls: formattedCalls });
}

async function handleBilling(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  const { start: monthStart, end: monthEnd } = getMonthBounds(new Date());

  const [allTxResult, monthTxResult, pendingResult, failedResult] = await Promise.all([
    serverClient
      .from('transactions')
      .select('id, user_id, reference, tokens, amount_minor, currency, provider, status, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    serverClient
      .from('transactions')
      .select('amount_minor, currency')
      .in('status', ['success', 'completed'])
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    serverClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    serverClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  const userIds = [...new Set((allTxResult.data || []).map((t) => t.user_id))];
  const { data: users } = await serverClient
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const totalRevenueMinor = (allTxResult.data || [])
    .filter((t) => t.status === 'success' || t.status === 'completed')
    .reduce((sum, t) => sum + (t.amount_minor || 0), 0);
  const monthlyRevenueMinor = (monthTxResult.data || []).reduce((sum, t) => sum + (t.amount_minor || 0), 0);
  const currency = allTxResult.data?.[0]?.currency || 'NGN';

  const transactions = (allTxResult.data || []).map((t) => {
    const user = userMap.get(t.user_id);
    const meta = (t.metadata as Record<string, unknown> | null) || {};
    return {
      id: t.id,
      reference: t.reference || '',
      user: user ? user.name || user.email : null,
      amount: t.amount_minor || 0,
      tokens: t.tokens || 0,
      currency: t.currency || 'COINS',
      provider: t.provider || '',
      type: (meta.type as string) || (meta.billing_type as string) || 'unknown',
      status: t.status || 'unknown',
      createdAt: t.created_at,
    };
  });

  res.status(200).json({
    totalRevenue: totalRevenueMinor / 100,
    monthlyRevenue: monthlyRevenueMinor / 100,
    pending: pendingResult.count || 0,
    failed: failedResult.count || 0,
    currency,
    transactions,
  });
}

async function handleSettings(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  const [numbersResult, callsResult, adminResult] = await Promise.all([
    serverClient.from('phone_numbers').select('*', { count: 'exact', head: true }),
    serverClient.from('call_logs').select('*', { count: 'exact', head: true }),
    serverClient.from('profiles').select('id, name, email, avatar').eq('role', 'admin'),
  ]);

  let totalMessages = 0;
  try {
    const msgs = await getMessages();
    totalMessages = msgs.length;
  } catch {
    // message store may be unavailable
  }

  const apiStatus = {
    telnyx: Boolean(process.env.TELNYX_API_KEY),
    supabase: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY),
    upstash: Boolean(process.env.UPSTASH_REDIS_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    korapay: Boolean(process.env.KORAPAY_SECRET_KEY),
  };

  const pricing = {
    coinsPerUsd: COINS_PER_USD,
    smsCoinsPerSegment: SMS_COINS_PER_SEGMENT,
    mmsCoinsPerMessage: MMS_COINS_PER_MESSAGE,
    numberSubscriptionCoins: NUMBER_SUBSCRIPTION_COINS,
    outboundCallCoinsPerSecond: OUTBOUND_CALL_COINS_PER_SECOND,
    inboundCallCoinsPerSecond: INBOUND_CALL_COINS_PER_SECOND,
    callRecordingCoinsPerMinute: CALL_RECORDING_COINS_PER_MINUTE,
  };

  const admins = (adminResult.data || []).map((a) => ({
    id: a.id,
    name: a.name || a.email?.split('@')[0] || 'Admin',
    email: a.email || '',
    avatar: a.avatar || '',
  }));

  res.status(200).json({
    totalNumbers: numbersResult.count || 0,
    totalCalls: callsResult.count || 0,
    totalMessages,
    apiStatus,
    pricing,
    admins,
  });
}

async function handleUpdateBalance(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { userId, tokens } = req.body || {};
  if (!userId || typeof tokens !== 'number') {
    res.status(400).json({ error: 'userId and tokens are required.' });
    return;
  }

  const { data: existing } = await serverClient
    .from('user_balances')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await serverClient
      .from('user_balances')
      .update({ tokens })
      .eq('id', userId);
    if (error) {
      res.status(500).json({ error: 'Failed to update balance: ' + error.message });
      return;
    }
  } else {
    const { error } = await serverClient
      .from('user_balances')
      .insert({ id: userId, tokens });
    if (error) {
      res.status(500).json({ error: 'Failed to create balance: ' + error.message });
      return;
    }
  }

  res.status(200).json({ success: true, userId, tokens });
}

async function handleUpdateTelegram(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { userId, chatId } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  if (chatId === null || chatId === '' || typeof chatId === 'string') {
    const { error } = await serverClient
      .from('profiles')
      .update({ telegram_chat_id: chatId || null })
      .eq('id', userId);

    if (error) {
      console.error('[admin/update-telegram] Error:', error.message);
      res.status(500).json({ error: 'Failed to update Telegram: ' + error.message });
      return;
    }

    res.status(200).json({ success: true, userId, telegramChatId: chatId || null });
  } else {
    res.status(400).json({ error: 'chatId must be a string or null.' });
  }
}

async function handleUpdateEmail(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { userId, email } = req.body || {};
  if (!userId || !email || typeof email !== 'string') {
    res.status(400).json({ error: 'userId and email are required.' });
    return;
  }

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    res.status(400).json({ error: 'Invalid email format.' });
    return;
  }

  const { data, error } = await serverClient.auth.admin.updateUserById(userId, { email: trimmed });

  if (error) {
    console.error('[admin/update-email] Error:', error.message);
    res.status(500).json({ error: 'Failed to update email: ' + error.message });
    return;
  }

  res.status(200).json({ success: true, userId, email: data.user?.email || trimmed });
}

async function handleUpdatePassword(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { userId, password } = req.body || {};
  if (!userId || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'userId and password are required.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const { error } = await serverClient.auth.admin.updateUserById(userId, { password });

  if (error) {
    console.error('[admin/update-password] Error:', error.message);
    res.status(500).json({ error: 'Failed to update password: ' + error.message });
    return;
  }

  res.status(200).json({ success: true, userId });
}

async function handleDeleteUser(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { userId } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  // Prevent deleting other admins
  const { data: targetProfile } = await serverClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (targetProfile?.role === 'admin') {
    res.status(403).json({ error: 'Cannot delete an admin account.' });
    return;
  }

  // Delete related data
  try {
    await serverClient.from('phone_numbers').delete().eq('user_id', userId);
  } catch (e) {
    console.warn('[admin/delete-user] phone_numbers cleanup:', (e as Error).message);
  }

  try {
    await serverClient.from('user_balances').delete().eq('id', userId);
  } catch (e) {
    console.warn('[admin/delete-user] user_balances cleanup:', (e as Error).message);
  }

  try {
    await serverClient.from('call_logs').delete().eq('user_id', userId);
  } catch (e) {
    console.warn('[admin/delete-user] call_logs cleanup:', (e as Error).message);
  }

  try {
    await serverClient.from('transactions').delete().eq('user_id', userId);
  } catch (e) {
    console.warn('[admin/delete-user] transactions cleanup:', (e as Error).message);
  }

  try {
    await serverClient.from('otp_codes').delete().eq('email', (
      await serverClient.auth.admin.getUserById(userId)
    ).data.user?.email || '');
  } catch (e) {
    console.warn('[admin/delete-user] otp_codes cleanup:', (e as Error).message);
  }

  // Delete profile
  try {
    await serverClient.from('profiles').delete().eq('id', userId);
  } catch (e) {
    console.warn('[admin/delete-user] profiles cleanup:', (e as Error).message);
  }

  // Delete auth user (this is the main deletion)
  const { error: deleteError } = await serverClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error('[admin/delete-user] auth delete error:', deleteError.message);
    res.status(500).json({ error: 'Failed to delete user: ' + deleteError.message });
    return;
  }

  res.status(200).json({ success: true, userId });
}

async function handleMakeAdmin(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { userId, role } = req.body || {};
  if (!userId || (role !== 'admin' && role !== 'user')) {
    res.status(400).json({ error: 'userId and role (admin|user) are required.' });
    return;
  }

  // If removing admin role (setting to 'user'), check if target is admin — prevent it
  if (role === 'user') {
    const { data: targetProfile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile?.role === 'admin') {
      res.status(403).json({ error: 'Cannot remove admin role from another admin.' });
      return;
    }
  }

  const { error } = await serverClient
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) {
    console.error('[admin/make-admin] Error:', error.message);
    res.status(500).json({ error: 'Failed to update role: ' + error.message });
    return;
  }

  res.status(200).json({ success: true, userId, role });
}

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';

function normalizePhone(number: string): string {
  const digits = number.replace(/\D/g, '');
  return digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+${digits}`;
}

async function handleAvailableNumbers(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  if (!TELNYX_API_KEY) {
    res.status(500).json({ error: 'Telnyx API key is not configured.' });
    return;
  }

  // 1. Fetch ALL numbers from Telnyx (authoritative source)
  let telnyxNumbers: Array<{ phone_number: string; status: string; features?: string[]; phone_type?: string; country?: string }> = [];
  try {
    const url = new URL('https://api.telnyx.com/v2/phone_numbers');
    url.searchParams.set('page[size]', '200');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[admin/available-numbers] Telnyx API error:', data);
      res.status(500).json({ error: 'Telnyx API request failed: ' + (data?.errors?.[0]?.detail || 'Unknown error') });
      return;
    }

    const rawRecords = (data?.data as Array<Record<string, unknown>>) || [];

    telnyxNumbers = rawRecords.map((record) => ({
      phone_number:
        (record.phone_number as string) ||
        (record.phone_number_e164 as string) ||
        (record.number as string) ||
        '',
      status: (record.status as string) || 'active',
      features: Array.isArray(record.features) ? record.features as string[] : [],
      phone_type: (record.phone_number_type as string) || '',
      country: (record.country_iso_alpha2 as string) || '',
    }));
    console.log('[admin/available-numbers] Telnyx returned', telnyxNumbers.length, 'numbers');
  } catch (err) {
    console.error('[admin/available-numbers] Telnyx fetch exception:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch numbers from Telnyx: ' + (err as Error).message });
    return;
  }

  // 2. Fetch Supabase phone_numbers for assignment info
  const { data: dbNumbers } = await serverClient
    .from('phone_numbers')
    .select('id, number, user_id, label, active');

  // Map: normalized number -> { id, user_id, label, active }
  const dbMap = new Map<string, { id: string; user_id: string | null; label: string; active: boolean }>();
  (dbNumbers || []).forEach((n) => {
    const normalized = normalizePhone(n.number || '');
    dbMap.set(normalized, { id: n.id, user_id: n.user_id, label: n.label || '', active: n.active });
  });

  // 3. Fetch owner names for assigned numbers
  const assignedUserIds = [...new Set([...dbMap.values()].map((v) => v.user_id).filter(Boolean))] as string[];
  let ownerMap = new Map<string, string>();
  if (assignedUserIds.length > 0) {
    const { data: authUsers } = await serverClient
      .from('users')
      .select('id, email')
      .in('id', assignedUserIds);
    const emailMap = new Map((authUsers || []).map((u) => [u.id, u.email || '']));

    const { data: profiles } = await serverClient
      .from('profiles')
      .select('id, name')
      .in('id', assignedUserIds);
    (profiles || []).forEach((p) => {
      ownerMap.set(p.id, p.name || emailMap.get(p.id) || 'Unknown');
    });
  }

  // 4. Merge: Telnyx numbers + Supabase assignment info
  const available = telnyxNumbers.map((t) => {
    const normalized = normalizePhone(t.phone_number);
    const dbRecord = dbMap.get(normalized);
    const telnyxLabel = t.phone_type ? t.phone_type.replace(/_/g, ' ') : '';
    return {
      id: dbRecord?.id || normalized,
      number: t.phone_number,
      label: dbRecord?.label || telnyxLabel,
      flag: t.country || '🌐',
      features: t.features || [],
      active: t.status === 'active',
      monthlyCost: 0,
      currentOwner: dbRecord?.user_id ? ownerMap.get(dbRecord.user_id) || 'Unknown' : null,
    };
  });

  res.status(200).json({ available, total: available.length });
}

async function handleAssignNumber(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { numberId, userId, phoneNumber } = req.body || {};
  console.log('[admin/assign-number] Request body:', { numberId, userId, phoneNumber });
  if ((!numberId && !phoneNumber) || !userId) {
    res.status(400).json({ error: 'numberId or phoneNumber, and userId are required.' });
    return;
  }

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  // If numberId is a valid UUID, try to update directly
  let existingId: string | null = null;
  if (numberId && isUuid(numberId)) {
    existingId = numberId;
  }

  // Otherwise, look up by phone number
  if (!existingId && phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    console.log('[admin/assign-number] Looking up by digits:', digits);
    const { data: existing, error: lookupError } = await serverClient
      .from('phone_numbers')
      .select('id')
      .ilike('number', `%${digits}%`)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('[admin/assign-number] Lookup error:', lookupError.message);
    }
    console.log('[admin/assign-number] Lookup result:', existing);
    existingId = existing?.id || null;
  }

  if (existingId) {
    // Update existing record
    const { error: updateError } = await serverClient
      .from('phone_numbers')
      .update({ user_id: userId, active: true })
      .eq('id', existingId);

    if (updateError) {
      res.status(500).json({ error: 'Failed to assign number: ' + updateError.message });
      return;
    }
  } else if (phoneNumber) {
    // Create new record for this Telnyx number
    const { data: inserted, error: insertError } = await serverClient
      .from('phone_numbers')
      .insert({
        number: phoneNumber,
        user_id: userId,
        active: true,
        label: '',
        flag: '🌐',
        features: [],
        monthly_cost: 0,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[admin/assign-number] Insert error:', insertError.message);
      res.status(500).json({ error: 'Failed to assign number: ' + insertError.message });
      return;
    }
    existingId = inserted?.id || null;
    console.log('[admin/assign-number] Inserted new record:', existingId);
  } else {
    res.status(404).json({ error: 'Phone number not found.' });
    return;
  }

  res.status(200).json({ success: true, numberId: existingId, userId });
}

async function handleUnassignNumber(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { numberId, phoneNumber } = req.body || {};
  console.log('[admin/unassign-number] Request body:', { numberId, phoneNumber });
  if (!numberId && !phoneNumber) {
    res.status(400).json({ error: 'numberId or phoneNumber is required.' });
    return;
  }

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  let targetId: string | null = null;
  if (numberId && isUuid(numberId)) {
    targetId = numberId;
  }
  if (!targetId && phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    console.log('[admin/unassign-number] Looking up by digits:', digits);
    const { data: existing, error: lookupError } = await serverClient
      .from('phone_numbers')
      .select('id, number')
      .ilike('number', `%${digits}%`)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('[admin/unassign-number] Lookup error:', lookupError.message);
      res.status(500).json({ error: 'Lookup failed: ' + lookupError.message });
      return;
    }
    console.log('[admin/unassign-number] Lookup result:', existing);
    targetId = existing?.id || null;
  }

  if (!targetId) {
    res.status(404).json({ error: 'Phone number not found in database.' });
    return;
  }

  const { error: deleteError } = await serverClient
    .from('phone_numbers')
    .delete()
    .eq('id', targetId);

  if (deleteError) {
    console.error('[admin/unassign-number] Delete error:', deleteError.message);
    res.status(500).json({ error: 'Failed to unassign number: ' + deleteError.message });
    return;
  }

  console.log('[admin/unassign-number] Success, deleted record:', targetId);
  res.status(200).json({ success: true, numberId: targetId });
}

async function handleMessages(res: VercelResponse) {
  const allMessages = await getMessages();

  const total = allMessages.length;
  const inbound = allMessages.filter((m) => m.direction === 'inbound').length;
  const outbound = allMessages.filter((m) => m.direction === 'outbound').length;
  const failed = allMessages.filter((m) => {
    const s = (m.status || '').toLowerCase();
    return s === 'failed' || s === 'error' || s === 'undelivered';
  }).length;

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

  res.status(200).json({ total, inbound, outbound, failed, messages });
}

async function handleTickets(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const status = (req.query.status as string) || null;
  const category = (req.query.category as string) || null;

  let query = serverClient
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data: tickets, error } = await query;

  if (error) {
    console.error('[admin/tickets] Error:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  // Fetch user names for tickets
  const userIds = [...new Set((tickets || []).map((t: { user_id: string }) => t.user_id))];
  let userMap = new Map<string, { name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await serverClient
      .from('profiles')
      .select('id, name')
      .in('id', userIds);
    (profiles || []).forEach((p: { id: string; name: string }) => {
      userMap.set(p.id, { name: p.name || 'Unknown', email: '' });
    });

    // Also try to get emails from auth
    for (const uid of userIds) {
      const { data: authUser } = await serverClient.auth.admin.getUserById(uid);
      if (authUser.user?.email) {
        const existing = userMap.get(uid);
        if (existing) {
          existing.email = authUser.user.email;
          userMap.set(uid, existing);
        } else {
          userMap.set(uid, { name: 'Unknown', email: authUser.user.email });
        }
      }
    }
  }

  const enriched = (tickets || []).map((t: Record<string, unknown>) => {
    const userInfo = userMap.get(t.user_id as string);
    return { ...t, user_name: userInfo?.name || 'Unknown', user_email: userInfo?.email || '' };
  });

  res.status(200).json({ tickets: enriched });
}

async function handleTicketDetail(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const ticketId = req.query.id as string;
  if (!ticketId) {
    res.status(400).json({ error: 'Missing ticket id.' });
    return;
  }

  const { data: ticket, error: ticketError } = await serverClient
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  // Get user info
  let userInfo = { name: 'Unknown', email: '' };
  const { data: profile } = await serverClient
    .from('profiles')
    .select('name')
    .eq('id', ticket.user_id)
    .maybeSingle();
  if (profile?.name) userInfo.name = profile.name;

  const { data: authUser } = await serverClient.auth.admin.getUserById(ticket.user_id);
  if (authUser.user?.email) userInfo.email = authUser.user.email;

  const { data: replies, error: repliesError } = await serverClient
    .from('support_ticket_replies')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (repliesError) {
    console.error('[admin/ticket-detail] Replies error:', repliesError.message);
  }

  res.status(200).json({ ticket: { ...ticket, user_name: userInfo.name, user_email: userInfo.email }, replies: replies || [] });
}

async function handleTicketReply(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { ticketId, message } = req.body || {};
  if (!ticketId || !message) {
    res.status(400).json({ error: 'ticketId and message are required.' });
    return;
  }

  // Get admin user id from token
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: adminData } = await serverClient.auth.getUser(token);
  if (!adminData.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { data: ticket } = await serverClient
    .from('support_tickets')
    .select('id, status')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (ticket.status === 'closed') {
    res.status(400).json({ error: 'Cannot reply to a closed ticket.' });
    return;
  }

  const { data: reply, error } = await serverClient
    .from('support_ticket_replies')
    .insert({
      ticket_id: ticketId,
      user_id: adminData.user.id,
      author_role: 'admin',
      message: message.trim(),
    })
    .select('*')
    .single();

  if (error) {
    console.error('[admin/ticket-reply] Error:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  // Update ticket status to pending and bump updated_at
  await serverClient
    .from('support_tickets')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  res.status(200).json({ reply });
}

async function handleTicketClose(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { ticketId } = req.body || {};
  if (!ticketId) {
    res.status(400).json({ error: 'ticketId is required.' });
    return;
  }

  const { error } = await serverClient
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) {
    console.error('[admin/ticket-close] Error:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ success: true, ticketId });
}

async function handleTicketReopen(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { ticketId } = req.body || {};
  if (!ticketId) {
    res.status(400).json({ error: 'ticketId is required.' });
    return;
  }

  const { error } = await serverClient
    .from('support_tickets')
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) {
    console.error('[admin/ticket-reopen] Error:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ success: true, ticketId });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const serverClient = await verifyAdmin(req, res);
  if (!serverClient) return;

  const action = (req.query.action as string) || 'overview';

  try {
    switch (action) {
      case 'overview':
        await handleOverview(serverClient, res);
        break;
      case 'numbers':
        await handleNumbers(serverClient, res);
        break;
      case 'messages':
        await handleMessages(res);
        break;
      case 'users':
        await handleUsers(serverClient, res);
        break;
      case 'calls':
        await handleCalls(serverClient, res);
        break;
      case 'billing':
        await handleBilling(serverClient, res);
        break;
      case 'settings':
        await handleSettings(serverClient, res);
        break;
      case 'update-balance':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'update-balance requires POST' });
          break;
        }
        await handleUpdateBalance(serverClient, req, res);
        break;
      case 'available-numbers':
        await handleAvailableNumbers(serverClient, res);
        break;
      case 'assign-number':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'assign-number requires POST' });
          break;
        }
        await handleAssignNumber(serverClient, req, res);
        break;
      case 'unassign-number':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'unassign-number requires POST' });
          break;
        }
        await handleUnassignNumber(serverClient, req, res);
        break;
      case 'update-telegram':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'update-telegram requires POST' });
          break;
        }
        await handleUpdateTelegram(serverClient, req, res);
        break;
      case 'update-email':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'update-email requires POST' });
          break;
        }
        await handleUpdateEmail(serverClient, req, res);
        break;
      case 'update-password':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'update-password requires POST' });
          break;
        }
        await handleUpdatePassword(serverClient, req, res);
        break;
      case 'delete-user':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'delete-user requires POST' });
          break;
        }
        await handleDeleteUser(serverClient, req, res);
        break;
      case 'make-admin':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'make-admin requires POST' });
          break;
        }
        await handleMakeAdmin(serverClient, req, res);
        break;
      case 'tickets':
        await handleTickets(serverClient, req, res);
        break;
      case 'ticket-detail':
        await handleTicketDetail(serverClient, req, res);
        break;
      case 'ticket-reply':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'ticket-reply requires POST' });
          break;
        }
        await handleTicketReply(serverClient, req, res);
        break;
      case 'ticket-close':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'ticket-close requires POST' });
          break;
        }
        await handleTicketClose(serverClient, req, res);
        break;
      case 'ticket-reopen':
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'ticket-reopen requires POST' });
          break;
        }
        await handleTicketReopen(serverClient, req, res);
        break;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Admin API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
