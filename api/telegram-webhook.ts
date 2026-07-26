import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { addMessage } from '../lib/message-store.js';
import { supabaseServer } from '../lib/supabase-server.js';
import { getTelegramUsername } from '../lib/telegram.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

async function getPhoneForChat(chatId: string | number): Promise<string | undefined> {
  const serverClient = supabaseServer();
  const { data: profile } = await serverClient
    .from('profiles')
    .select('phone_number')
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle();
  return profile?.phone_number || TELNYX_PHONE_NUMBER || undefined;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LINK-${code.slice(0, 4)}-${code.slice(4)}`;
}

function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body as Buffer | string | Record<string, unknown>;
  if (Buffer.isBuffer(raw)) {
    return JSON.parse(raw.toString('utf8'));
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  return raw as Record<string, unknown>;
}

function extractSenderFromForwarded(text: string): { from?: string; to?: string } {
  const originMatch = text.match(/New SMS (?:from|to)\s+(\+?[\d\s()-]+)/);
  const userMatch = text.match(/(?:To|From):\s*(\+?[\d\s()-]+)/);
  return {
    from: originMatch ? originMatch[1].replace(/\s/g, '') : undefined,
    to: userMatch ? userMatch[1].replace(/\s/g, '') : undefined,
  };
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('Telegram reply failed:', err);
  }
}

async function verifyTelegramCode(chatId: number, text: string): Promise<boolean> {
  const codeMatch = text.match(/(?:\/start\s+)?(LINK-[A-Z0-9]{4}-[A-Z0-9]{4})/);
  const code = codeMatch?.[1];
  if (!code) return false;

  const serverClient = supabaseServer();
  const { data: profile } = await serverClient
    .from('profiles')
    .select('id, name')
    .eq('telegram_code', code)
    .gt('telegram_code_expires_at', new Date().toISOString())
    .maybeSingle();

  if (!profile) {
    await sendTelegramMessage(chatId, '❌ Invalid or expired code. Please generate a new one in your Phonicity settings.');
    return true;
  }

  await serverClient
    .from('profiles')
    .update({
      telegram_chat_id: String(chatId),
      telegram_enabled: true,
      telegram_code: null,
      telegram_code_expires_at: null,
    })
    .eq('id', profile.id);

  await sendTelegramMessage(chatId, `✅ *Telegram linked!*\n\nHello${profile.name ? ` ${profile.name}` : ''}, you'll now receive notifications here when enabled.`);
  return true;
}

async function sendSmsViaTelnyx(from: string, to: string, text: string) {
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, text }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.detail || 'Telnyx send failed');
  }
  const message = data.data;
  await addMessage({
    sid: message.id,
    from: message.from?.phone_number || from,
    to: message.to?.[0]?.phone_number || to,
    body: message.text || text,
    direction: 'outbound',
    dateCreated: message.received_at || new Date().toISOString(),
    status: message.to?.[0]?.status || 'queued',
  });
  return message;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Bot-info action (called from Settings UI to get bot username for login widget)
  if (req.query.action === 'bot-info') {
    const botUsername = await getTelegramUsername();
    if (!botUsername) {
      res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured.' });
      return;
    }
    res.status(200).json({ username: botUsername });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  // Link-widget action (called from Settings UI after Telegram Login Widget auth)
  if (req.query.action === 'link-widget') {
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

    let body: Record<string, unknown>;
    try {
      body = parseJsonBody(req);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }

    const telegramId = body.id as number | undefined;
    const hash = body.hash as string | undefined;
    const authDate = body.auth_date as number | undefined;
    const firstName = (body.first_name as string) || '';
    const username = (body.username as string) || '';

    if (!telegramId || !hash || !authDate) {
      res.status(400).json({ error: 'Missing required Telegram auth fields.' });
      return;
    }

    // Verify the hash to ensure this is an authentic Telegram login
    // See: https://core.telegram.org/widgets/login#checking-authorization
    const dataCheckString = Object.keys(body)
      .filter((k) => k !== 'hash' && body[k] !== undefined && body[k] !== null)
      .sort()
      .map((k) => `${k}=${body[k]}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebBotDataToken').update(TELEGRAM_BOT_TOKEN).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) {
      console.error('[Telegram] Login widget hash verification failed');
      res.status(401).json({ error: 'Telegram auth verification failed.' });
      return;
    }

    // Check auth_date isn't too old (within 1 hour)
    const authAge = Date.now() / 1000 - authDate;
    if (authAge > 3600) {
      res.status(401).json({ error: 'Telegram auth expired. Please try again.' });
      return;
    }

    const chatId = String(telegramId);
    const { error: updateError } = await serverClient
      .from('profiles')
      .update({
        telegram_chat_id: chatId,
        telegram_enabled: true,
        telegram_code: null,
        telegram_code_expires_at: null,
      })
      .eq('id', userData.user.id);

    if (updateError) {
      console.error('[Telegram] Failed to save chat ID from widget:', updateError.message);
      res.status(500).json({ error: 'Failed to link Telegram.' });
      return;
    }

    console.log('[Telegram] Linked via login widget — user:', userData.user.id, 'chat_id:', chatId, 'username:', username);

    // Send a confirmation message to the user's Telegram
    await sendTelegramMessage(chatId, `✅ *Telegram linked!\n\nHello${firstName ? ` ${firstName}` : ''}, you'll now receive SMS notifications here when enabled.`);

    res.status(200).json({ success: true, chatId });
    return;
  }

  // Generate-code action (called from Settings UI)
  if (req.query.action === 'generate-code') {
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
      res.status(500).json({ error: 'Failed to generate code.', details: error.message });
      return;
    }

    const botUsername = await getTelegramUsername();
    const link = botUsername
      ? `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`
      : undefined;

    res.status(200).json({ code, link, expiresAt });
    return;
  }

  // Optional secret check
  if (TELEGRAM_WEBHOOK_SECRET && req.query.secret !== TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = parseJsonBody(req);
  } catch (parseErr) {
    console.error('Failed to parse Telegram body:', parseErr);
    res.status(200).json({ ok: true });
    return;
  }

  const message = body.message as Record<string, unknown> | undefined;
  if (!message) {
    res.status(200).json({ ok: true });
    return;
  }

  const chatObj = message.chat as Record<string, unknown> | undefined;
  const chatId = chatObj?.id as number | undefined;
  const text = (message.text as string) || '';
  if (!chatId || !text) {
    res.status(200).json({ ok: true });
    return;
  }

  console.log('Telegram message from', chatId, ':', text);
  console.log('Telnyx API key status:', { hasKey: !!TELNYX_API_KEY, keyPrefix: TELNYX_API_KEY ? TELNYX_API_KEY.slice(0, 6) + '...' : 'MISSING' });

  try {
    // Case 0: Link Telegram account via code
    if (await verifyTelegramCode(chatId, text)) {
      res.status(200).json({ ok: true });
      return;
    }

    // Case 1: Reply to a forwarded SMS message
    const replyTo = message.reply_to_message as Record<string, unknown> | undefined;
    if (replyTo && replyTo.text) {
      const originalText = String(replyTo.text);
      const { from: originalSender, to: originalTo } = extractSenderFromForwarded(originalText);
      if (originalSender && originalTo) {
        const replyText = text.trim();
        await sendSmsViaTelnyx(originalTo, originalSender, replyText);
        await sendTelegramMessage(chatId, `✅ *Reply sent* to ${originalSender}\n\n${replyText}`);
        res.status(200).json({ ok: true });
        return;
      }
    }

    // Case 2: /sms command
    const smsCmdMatch = text.match(/^\/sms\s+(\+?[\d\s()-]+)\s+(.+)/s);
    if (smsCmdMatch) {
      const toNumber = smsCmdMatch[1].replace(/\s/g, '');
      const messageBody = smsCmdMatch[2].trim();
      const fromNumber = (await getPhoneForChat(chatId)) || TELNYX_PHONE_NUMBER;
      if (!fromNumber) {
        await sendTelegramMessage(chatId, '❌ No outbound phone number configured. Set TELNYX_PHONE_NUMBER or add a verified sender number in Settings.');
        res.status(200).json({ ok: true });
        return;
      }
      await sendSmsViaTelnyx(fromNumber, toNumber, messageBody);
      await sendTelegramMessage(chatId, `✅ *SMS sent* from ${fromNumber} to ${toNumber}\n\n${messageBody}`);
      res.status(200).json({ ok: true });
      return;
    }

    // Unknown command
    if (text.startsWith('/')) {
      await sendTelegramMessage(
        chatId,
        'ℹ️ *Commands:*\n\n' +
        '• Reply to any forwarded SMS to send a reply\n' +
        '• `/sms +1234567890 Hello world` — send a new SMS'
      );
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    const error = err as Error;
    console.error('Telegram webhook error:', error);
    await sendTelegramMessage(chatId, `❌ Error: ${error.message}`);
    res.status(200).json({ ok: true });
  }
}
