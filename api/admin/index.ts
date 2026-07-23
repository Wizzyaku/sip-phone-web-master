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

async function handleUsers(serverClient: ReturnType<typeof supabaseServer>, res: VercelResponse) {
  const { data: profiles, error: profilesError } = await serverClient
    .from('profiles')
    .select('*');

  if (profilesError) {
    console.error('[admin/users] profiles query error:', profilesError.message);
    res.status(500).json({ error: 'Failed to fetch users: ' + profilesError.message });
    return;
  }

  const profileList = profiles || [];
  const userIds = profileList.map((p) => p.id);
  const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

  // Fetch emails and created_at from auth.users (not in profiles table)
  const authMap = new Map<string, { email: string; created_at: string }>();
  try {
    const { data: authUsers, error: authError } = await serverClient
      .from('users')
      .select('id, email, created_at')
      .in('id', safeIds);

    if (authError) {
      console.warn('[admin/users] auth.users query failed:', authError.message);
    } else {
      (authUsers || []).forEach((u) => {
        authMap.set(u.id, { email: u.email || '', created_at: u.created_at || '' });
      });
    }
  } catch (e) {
    console.warn('[admin/users] auth.users query exception:', (e as Error).message);
  }

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

  const total = profileList.length;
  const admins = profileList.filter((p) => p.role === 'admin').length;
  const suspended = 0;
  const active = profileList.filter((p) => {
    const authData = authMap.get(p.id);
    return authData && activeEmails.has(authData.email);
  }).length;

  const users = profileList.map((p) => {
    const authData = authMap.get(p.id);
    const email = authData?.email || '';
    const userNumbers = userNumbersMap.get(p.id) || [];
    return {
      id: p.id,
      name: p.name || email?.split('@')[0] || 'User',
      email,
      avatar: p.avatar || '',
      phoneNumber: userNumbers[0]?.number || null,
      role: p.role || 'user',
      createdAt: authData?.created_at || null,
      tokenBalance: balanceMap.get(p.id) || 0,
      assignedNumbers: userNumbers.length,
      numbers: userNumbers,
      telegram: p.telegram_username || p.telegram_id || null,
    };
  });

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
  let telnyxNumbers: Array<{ phone_number: string; status: string; features?: string[] }> = [];
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
    if (rawRecords.length > 0) {
      console.log('[admin/available-numbers] Raw Telnyx record sample:', JSON.stringify(rawRecords[0], null, 2));
    }

    telnyxNumbers = rawRecords.map((record) => ({
      phone_number:
        (record.phone_number as string) ||
        (record.phone_number_e164 as string) ||
        (record.number as string) ||
        (record.friendly_name as string) ||
        '',
      status: (record.status as string) || 'active',
      features: Array.isArray(record.features) ? record.features as string[] : [],
    }));
    console.log('[admin/available-numbers] Telnyx returned', telnyxNumbers.length, 'numbers; first number value:', telnyxNumbers[0]?.phone_number || '(empty)');
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
    return {
      id: dbRecord?.id || normalized,
      number: t.phone_number,
      label: dbRecord?.label || '',
      flag: '🌐',
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
    const normalized = normalizePhone(phoneNumber);
    const { data: existing } = await serverClient
      .from('phone_numbers')
      .select('id')
      .ilike('number', `%${normalized.replace(/\D/g, '')}%`)
      .limit(1)
      .maybeSingle();
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
    const { error: insertError } = await serverClient
      .from('phone_numbers')
      .insert({
        number: phoneNumber,
        user_id: userId,
        active: true,
        label: '',
        flag: '🌐',
        features: [],
        monthly_cost: 0,
      });

    if (insertError) {
      res.status(500).json({ error: 'Failed to assign number: ' + insertError.message });
      return;
    }
  } else {
    res.status(404).json({ error: 'Phone number not found.' });
    return;
  }

  res.status(200).json({ success: true, numberId: existingId, userId });
}

async function handleUnassignNumber(serverClient: ReturnType<typeof supabaseServer>, req: VercelRequest, res: VercelResponse) {
  const { numberId, phoneNumber } = req.body || {};
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
    const normalized = normalizePhone(phoneNumber);
    const { data: existing } = await serverClient
      .from('phone_numbers')
      .select('id')
      .ilike('number', `%${normalized.replace(/\D/g, '')}%`)
      .limit(1)
      .maybeSingle();
    targetId = existing?.id || null;
  }

  if (!targetId) {
    res.status(404).json({ error: 'Phone number not found in database.' });
    return;
  }

  const { error: updateError } = await serverClient
    .from('phone_numbers')
    .update({ user_id: null })
    .eq('id', targetId);

  if (updateError) {
    res.status(500).json({ error: 'Failed to unassign number: ' + updateError.message });
    return;
  }

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
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Admin API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
