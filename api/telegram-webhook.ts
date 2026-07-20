import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addMessage } from '../lib/message-store.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

function normalizePhone(number: string): string {
  return number.replace(/\D/g, '');
}

function parseNumberMap(): Map<string, string> {
  const map = new Map<string, string>();
  const raw = process.env.TELEGRAM_NUMBER_MAP;
  if (!raw) return map;
  const entries = raw.split(',');
  for (const entry of entries) {
    const [phone, chatId] = entry.split(':');
    if (phone && chatId) {
      map.set(normalizePhone(phone.trim()), chatId.trim());
    }
  }
  return map;
}

function getPhoneForChat(chatId: string | number): string | undefined {
  const numberMap = parseNumberMap();
  const target = String(chatId);
  for (const [phone, mappedChatId] of numberMap.entries()) {
    if (mappedChatId === target) {
      return '+' + phone;
    }
  }
  return TELNYX_PHONE_NUMBER || undefined;
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
  const fromMatch = text.match(/New SMS from (\+?[\d\s()-]+)/);
  const toMatch = text.match(/To:\s*(\+?[\d\s()-]+)/);
  return {
    from: fromMatch ? fromMatch[1].replace(/\s/g, '') : undefined,
    to: toMatch ? toMatch[1].replace(/\s/g, '') : undefined,
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

  if (req.method !== 'POST') {
    res.status(405).end();
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
      const fromNumber = getPhoneForChat(chatId) || TELNYX_PHONE_NUMBER;
      if (!fromNumber) {
        await sendTelegramMessage(chatId, '❌ No outbound phone number configured. Set TELNYX_PHONE_NUMBER or TELEGRAM_NUMBER_MAP.');
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
