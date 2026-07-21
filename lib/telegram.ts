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
  const withPlus = '+' + normalized;

  // Find the owner of this phone number from phone_numbers table
  const { data: phoneRow } = await serverClient
    .from('phone_numbers')
    .select('user_id')
    .eq('active', true)
    .or(`number.eq.${withPlus},number.ilike.%${normalized}`)
    .limit(1)
    .maybeSingle();

  let userId: string | undefined = phoneRow?.user_id;

  // Fall back to profiles.phone_number
  if (!userId) {
    const { data: profileRow } = await serverClient
      .from('profiles')
      .select('id')
      .or(`phone_number.eq.${withPlus},phone_number.ilike.%${normalized}`)
      .limit(1)
      .maybeSingle();
    userId = profileRow?.id;
  }

  if (!userId) return;

  const { data: profile } = await serverClient
    .from('profiles')
    .select('telegram_chat_id, telegram_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.telegram_enabled && profile?.telegram_chat_id) {
    await sendTelegramMessage(profile.telegram_chat_id, text);
  }
}
