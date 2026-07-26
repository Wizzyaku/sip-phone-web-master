import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addMessage, updateMessageStatus } from '../lib/message-store.js';
import { supabaseServer } from '../lib/supabase-server.js';
import { SMS_COINS_PER_SEGMENT, estimateSmsSegments } from '../lib/billing.js';
import { notifyTelegramByPhone, notifyTelegramByUserId } from '../lib/telegram.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function normalizePhone(number: string): string {
  return number.replace(/\D/g, '');
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

  let body: Record<string, unknown>;
  try {
    body = parseJsonBody(req);
    console.log('Webhook body keys:', Object.keys(body || {}));
  } catch (parseErr) {
    console.error('Failed to parse body:', parseErr, 'req.body type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
    res.status(200).json({ received: true });
    return;
  }

  try {
    const event = body.data as Record<string, unknown> | undefined;
    const eventType = event?.event_type;

    console.log('Telnyx webhook event type:', eventType);

    if (eventType === 'message.received') {
      const payload = event?.payload as Record<string, unknown> | undefined;
      const from = (payload?.from as Record<string, unknown> | undefined)?.phone_number as string | undefined;
      const to = ((payload?.to as unknown[])?.[0] as Record<string, unknown> | undefined)?.phone_number as string | undefined;
      const msgBody = payload?.text as string | undefined;
      const sid = payload?.id as string | undefined;

      if (!from || !to || !msgBody || !sid) {
        console.warn('Incomplete inbound message payload:', payload);
      } else {
        const fromNormalized = normalizePhone(from);
        const toNormalized = normalizePhone(to);
        const serverClient = supabaseServer();

        // Check if the 'from' number belongs to any platform user.
        // If so, this message was already stored by send-sms.ts when the user sent it.
        // The GET /messages endpoint recalculates direction relative to the viewing user,
        // so we don't need to store it again here — that would create a duplicate.
        let fromOwnerId: string | null = null;
        const { data: fromOwner } = await serverClient
          .from('phone_numbers')
          .select('user_id, number')
          .eq('active', true)
          .filter('number', 'eq', fromNormalized)
          .maybeSingle();

        if (fromOwner?.user_id) {
          fromOwnerId = fromOwner.user_id;
        } else {
          const { data: altFromOwner } = await serverClient
            .from('phone_numbers')
            .select('user_id, number')
            .eq('active', true)
            .like('number', `%${fromNormalized}%`)
            .limit(1)
            .maybeSingle();
          if (altFromOwner?.user_id) fromOwnerId = altFromOwner.user_id;
        }

        // Check who owns the 'to' number for billing and Telegram notifications
        let toOwnerId: string | null = null;
        const { data: toOwner } = await serverClient
          .from('phone_numbers')
          .select('user_id, number')
          .eq('active', true)
          .filter('number', 'eq', toNormalized)
          .maybeSingle();

        if (toOwner?.user_id) {
          toOwnerId = toOwner.user_id;
        } else {
          const { data: altToOwner } = await serverClient
            .from('phone_numbers')
            .select('user_id, number')
            .eq('active', true)
            .like('number', `%${toNormalized}%`)
            .limit(1)
            .maybeSingle();
          if (altToOwner?.user_id) toOwnerId = altToOwner.user_id;
        }

        // If the 'from' number belongs to a platform user, the message was already
        // stored by send-sms.ts. Skip addMessage to avoid duplicates, but STILL
        // send Telegram notification to the recipient.
        if (fromOwnerId) {
          console.log('Skipping addMessage in webhook — from number is owned by a platform user (already stored by send-sms):', { from, to, body: msgBody });
        } else {
          await addMessage({
            sid,
            from,
            to,
            body: msgBody,
            direction: 'inbound',
            dateCreated: (payload?.received_at as string) || new Date().toISOString(),
            status: 'received',
          });
          console.log('Inbound SMS received:', { from, to, body: msgBody });

          // Charge the number owner for inbound SMS
          try {
            if (toOwnerId) {
              const segments = estimateSmsSegments(msgBody!);
              const smsCost = SMS_COINS_PER_SEGMENT * segments;

              const { error: chargeError } = await serverClient.rpc('charge_sms', {
                p_user_id: toOwnerId,
                p_coins: smsCost,
                p_message_sid: sid,
                p_direction: 'inbound',
                p_type: 'sms',
                p_segments: segments,
              });

              if (chargeError) {
                console.error('Inbound SMS charge error:', chargeError.message);
              } else {
                console.log(`Charged ${smsCost} coins for inbound SMS to ${toOwnerId}`);
              }

              // Log to messages_log
              await serverClient.from('messages_log').insert({
                user_id: toOwnerId,
                message_sid: sid,
                direction: 'inbound',
                type: 'sms',
                segments,
                from_number: from,
                to_number: to,
                cost_coins: smsCost,
                status: 'received',
              });
            }
          } catch (billingErr) {
            console.error('Inbound SMS billing error:', billingErr);
          }
        }

        // Always send Telegram notification to the recipient (regardless of whether
        // the message was stored by us or by send-sms)
        const telegramMessage = `*New SMS from ${from}*\n\n${msgBody}\n\n_To: ${to}_\n\nReply to this message to respond.`;
        if (toOwnerId) {
          await notifyTelegramByUserId(toOwnerId, telegramMessage);
        } else {
          await notifyTelegramByPhone(to, telegramMessage);
        }
      }
    } else if (eventType === 'message.delivery_update') {
      const payload = event?.payload as Record<string, unknown> | undefined;
      const sid = (payload?.id as string) || ((payload?.message_id as string) || '');
      const toData = payload?.to as unknown[];
      const deliveryStatus = (toData?.[0] as Record<string, unknown>)?.status as string | undefined;

      if (sid && deliveryStatus) {
        console.log('[webhook] Delivery update for', sid, '->', deliveryStatus);
        try {
          await updateMessageStatus(sid, deliveryStatus);
        } catch (updateErr) {
          console.error('[webhook] Failed to update message status:', (updateErr as Error).message);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    const error = err as Error;
    console.error('Webhook error:', error);
    res.status(200).json({ received: true });
  }
}
