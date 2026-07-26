import { supabaseServer } from './supabase-server.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn('[Telegram] Missing token or chat ID:', { hasToken: !!TELEGRAM_BOT_TOKEN, chatId });
    return;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      console.error('[Telegram] API error:', response.status, responseBody);
    } else {
      console.log('[Telegram] Sent to', chatId);
    }
  } catch (err) {
    console.error('[Telegram] Send failed:', err);
  }
}

export async function getTelegramUsername(): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await response.json() as { ok?: boolean; result?: { username?: string } };
    return data?.result?.username ?? null;
  } catch (err) {
    console.error('[Telegram] getMe failed:', err);
    return null;
  }
}

export async function notifyTelegramByPhone(phoneNumber: string, text: string): Promise<void> {
  const serverClient = supabaseServer();
  const normalized = phoneNumber.replace(/\D/g, '');

  if (!normalized) {
    console.warn('[Telegram] notifyTelegramByPhone: empty phone number after normalize');
    return;
  }

  // Find the owner of this phone number from phone_numbers table
  // Use digits-only matching (same approach as sms-webhook)
  const { data: phoneRow, error: phoneErr } = await serverClient
    .from('phone_numbers')
    .select('user_id, number')
    .eq('active', true)
    .filter('number', 'eq', normalized)
    .limit(1)
    .maybeSingle();

  let userId: string | undefined;

  if (phoneErr) {
    console.error('[Telegram] phone_numbers query error:', phoneErr.message);
  }

  if (phoneRow?.user_id) {
    userId = phoneRow.user_id;
    console.log('[Telegram] Found owner via phone_numbers table:', userId);
  } else {
    // Try ilike fallback (number stored with + prefix or different format)
    const { data: altPhoneRow } = await serverClient
      .from('phone_numbers')
      .select('user_id, number')
      .eq('active', true)
      .like('number', `%${normalized}%`)
      .limit(1)
      .maybeSingle();

    if (altPhoneRow?.user_id) {
      userId = altPhoneRow.user_id;
      console.log('[Telegram] Found owner via phone_numbers ilike fallback:', userId, 'stored as:', altPhoneRow.number);
    }
  }

  // Fall back to profiles.phone_number
  if (!userId) {
    const { data: profileRow } = await serverClient
      .from('profiles')
      .select('id, phone_number')
      .filter('phone_number', 'eq', normalized)
      .limit(1)
      .maybeSingle();

    if (profileRow?.id) {
      userId = profileRow.id;
      console.log('[Telegram] Found owner via profiles.phone_number eq:', userId);
    } else {
      const { data: altProfileRow } = await serverClient
        .from('profiles')
        .select('id, phone_number')
        .like('phone_number', `%${normalized}%`)
        .limit(1)
        .maybeSingle();

      if (altProfileRow?.id) {
        userId = altProfileRow.id;
        console.log('[Telegram] Found owner via profiles.phone_number ilike:', userId);
      }
    }
  }

  if (!userId) {
    console.warn('[Telegram] No user found for phone number:', phoneNumber, '(normalized:', normalized + ')');
    return;
  }

  const { data: profile, error: profileErr } = await serverClient
    .from('profiles')
    .select('telegram_chat_id, telegram_enabled, name')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    console.error('[Telegram] Profile query error:', profileErr.message);
    return;
  }

  if (!profile) {
    console.warn('[Telegram] No profile found for user:', userId);
    return;
  }

  if (!profile.telegram_chat_id) {
    console.warn('[Telegram] User', userId, 'has no telegram_chat_id — not linked');
    return;
  }

  if (!profile.telegram_enabled) {
    console.warn('[Telegram] User', userId, 'has telegram_enabled = false — notifications disabled');
    return;
  }

  console.log('[Telegram] Sending notification to user', userId, 'chat_id:', profile.telegram_chat_id);
  await sendTelegramMessage(profile.telegram_chat_id, text);
}

export async function notifyTelegramByUserId(userId: string, text: string): Promise<void> {
  const serverClient = supabaseServer();

  const { data: profile, error: profileErr } = await serverClient
    .from('profiles')
    .select('telegram_chat_id, telegram_enabled, name')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    console.error('[Telegram] notifyTelegramByUserId profile query error:', profileErr.message);
    return;
  }

  if (!profile) {
    console.warn('[Telegram] notifyTelegramByUserId: no profile for user:', userId);
    return;
  }

  if (!profile.telegram_chat_id) {
    console.warn('[Telegram] notifyTelegramByUserId: user', userId, 'has no telegram_chat_id — not linked');
    return;
  }

  if (!profile.telegram_enabled) {
    console.warn('[Telegram] notifyTelegramByUserId: user', userId, 'has telegram_enabled = false — notifications disabled');
    return;
  }

  console.log('[Telegram] Sending notification to user', userId, 'chat_id:', profile.telegram_chat_id);
  await sendTelegramMessage(profile.telegram_chat_id, text);
}
