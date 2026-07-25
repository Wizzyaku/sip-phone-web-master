import { Redis } from '@upstash/redis';

export interface StoredMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  direction: 'inbound' | 'outbound';
  dateCreated: string;
  status: string;
}

const url =
  process.env.UPSTASH_REDIS_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.UPSTASH_REDIS_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error(
    'Missing Upstash Redis credentials. Set UPSTASH_REDIS_KV_REST_API_URL and UPSTASH_REDIS_KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).'
  );
}

const redis = new Redis({ url, token });
const MESSAGES_KEY = 'messages';
const SIDS_KEY = 'message_sids';
const MAX_MESSAGES = 1000;

export async function getMessages(): Promise<StoredMessage[]> {
  const raw = await redis.lrange(MESSAGES_KEY, 0, -1);
  return (raw as unknown[]).map((item) => {
    if (typeof item === 'string') {
      return JSON.parse(item) as StoredMessage;
    }
    return item as StoredMessage;
  });
}

export async function addMessage(msg: StoredMessage): Promise<void> {
  const added = await redis.sadd(SIDS_KEY, msg.sid);
  if (added === 0) {
    console.log('[message-store] Duplicate message skipped:', msg.sid);
    return;
  }
  await redis.lpush(MESSAGES_KEY, JSON.stringify(msg));
  await redis.ltrim(MESSAGES_KEY, 0, MAX_MESSAGES - 1);
}

export async function updateMessageStatus(sid: string, status: string): Promise<void> {
  const messages = await getMessages();
  const idx = messages.findIndex((m) => m.sid === sid);
  if (idx === -1) {
    console.log('[message-store] Message not found for status update:', sid);
    return;
  }
  messages[idx].status = status;
  await redis.del(MESSAGES_KEY);
  for (let i = messages.length - 1; i >= 0; i--) {
    await redis.rpush(MESSAGES_KEY, JSON.stringify(messages[i]));
  }
  console.log('[message-store] Updated status for', sid, 'to', status);
}
