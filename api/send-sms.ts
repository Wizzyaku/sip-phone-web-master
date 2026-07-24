import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addMessage, getMessages } from '../lib/message-store.js';
import { supabaseServer } from '../lib/supabase-server.js';
import {
  SMS_COINS_PER_SEGMENT,
  MMS_COINS_PER_MESSAGE,
  estimateSmsSegments,
} from '../lib/billing.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? '';

async function getOrCreateMessagingProfile(): Promise<string | null> {
  try {
    const listRes = await fetch('https://api.telnyx.com/v2/messaging_profiles?page[size]=1', {
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}` },
    });
    const listData = await listRes.json();
    const existing = listData?.data?.[0];
    if (existing?.id) {
      return existing.id as string;
    }
    const createRes = await fetch('https://api.telnyx.com/v2/messaging_profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Default Messaging Profile',
        whitelisted_destinations: ['US', 'CA', 'GB'],
      }),
    });
    const createData = await createRes.json();
    if (createData?.data?.id) {
      console.log('[Telnyx] Created messaging profile:', createData.data.id);
      return createData.data.id as string;
    }
    console.error('[Telnyx] Failed to create messaging profile:', createData);
    return null;
  } catch (err) {
    console.error('[Telnyx] getOrCreateMessagingProfile error:', err);
    return null;
  }
}

async function assignNumberToMessagingProfile(phoneNumber: string): Promise<boolean> {
  try {
    const profileId = await getOrCreateMessagingProfile();
    if (!profileId) return false;
    const assignRes = await fetch(`https://api.telnyx.com/v2/messaging_phone_numbers/${phoneNumber}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_profile_id: profileId }),
    });
    const assignData = await assignRes.json();
    if (assignRes.ok) {
      console.log('[Telnyx] Assigned', phoneNumber, 'to messaging profile', profileId);
      return true;
    }
    console.error('[Telnyx] Failed to assign number to profile:', assignData);
    return false;
  } catch (err) {
    console.error('[Telnyx] assignNumberToMessagingProfile error:', err);
    return false;
  }
}

function normalizePhone(number: string): string {
  let digits = number.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '1' + digits;
  }
  return '+' + digits;
}

function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body as Buffer | string | Record<string, unknown>;
  if (Buffer.isBuffer(raw)) {
    return JSON.parse(raw.toString('utf8'));
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return {};
}

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
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

  if (req.method === 'GET') {
    const { data: phoneRows, error: phoneError } = await serverClient
      .from('phone_numbers')
      .select('number')
      .eq('user_id', userData.user.id);

    if (phoneError) {
      console.error('Failed to fetch phone numbers:', phoneError);
      res.status(500).json({ error: 'Failed to fetch user phone numbers.' });
      return;
    }

    const userNumbers = (phoneRows || []).map((row: { number: string }) => row.number.replace(/\D/g, ''));

    if (userNumbers.length === 0) {
      res.status(200).json([]);
      return;
    }

    const allMessages = await getMessages();
    const filtered = allMessages.filter((m) => {
      const fromNorm = (m.from || '').replace(/\D/g, '');
      const toNorm = (m.to || '').replace(/\D/g, '');
      return userNumbers.includes(fromNorm) || userNumbers.includes(toNorm);
    });

    // Recalculate direction relative to the viewing user:
    // If the 'from' number belongs to this user → outbound (they sent it)
    // If the 'to' number belongs to this user (and 'from' doesn't) → inbound (they received it)
    const recalculated = filtered.map((m) => {
      const fromNorm = (m.from || '').replace(/\D/g, '');
      const toNorm = (m.to || '').replace(/\D/g, '');
      const fromIsUserNumber = userNumbers.includes(fromNorm);
      const toIsUserNumber = userNumbers.includes(toNorm);
      if (fromIsUserNumber && !toIsUserNumber) {
        return { ...m, direction: 'outbound' as const };
      }
      if (toIsUserNumber && !fromIsUserNumber) {
        return { ...m, direction: 'inbound' as const };
      }
      // Both or neither match — keep original direction
      return m;
    });

    console.log(`Returning ${recalculated.length} messages for user ${userData.user.id} (out of ${allMessages.length} total)`);
    res.status(200).json(recalculated);
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = parseJsonBody(req);
    if (Object.keys(body).length === 0) {
      const rawText = await readRawBody(req);
      if (rawText) {
        body = JSON.parse(rawText);
      }
    }
  } catch (parseErr) {
    console.error('Failed to parse body:', parseErr, 'req.body type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { data: balanceData, error: balanceError } = await serverClient
    .from('user_balances')
    .select('tokens')
    .eq('id', userData.user.id)
    .maybeSingle();

  const rawTo = body.to as string | undefined;
  const messageBody = body.body as string | undefined;
  const rawFrom = body.from as string | undefined;

  console.log('Send SMS request. to:', rawTo, 'from:', rawFrom, 'body:', messageBody, 'parsedBody keys:', Object.keys(body));
  if (!rawTo || !messageBody) {
    res.status(400).json({ error: `Missing "to" or "body". Received to: "${rawTo}", body: "${messageBody}"` });
    return;
  }

  const to = normalizePhone(rawTo);

  if (!rawFrom) {
    res.status(400).json({ error: 'Missing "from" number.' });
    return;
  }

  // Check balance and calculate SMS cost
  const segments = estimateSmsSegments(messageBody);
  const isMms = Boolean(body.mediaUrl);
  const smsCost = isMms
    ? MMS_COINS_PER_MESSAGE * segments
    : SMS_COINS_PER_SEGMENT * segments;

  if (!balanceData || Number(balanceData.tokens) < smsCost) {
    res.status(402).json({
      error: `Insufficient balance. You need ${smsCost} coins to send this message.`,
      required: smsCost,
    });
    return;
  }

  const fromNumber = normalizePhone(rawFrom);

  // Verify the from number belongs to the authenticated user
  const { data: phoneRows, error: phoneError } = await serverClient
    .from('phone_numbers')
    .select('number')
    .eq('user_id', userData.user.id);

  if (phoneError) {
    console.error('Failed to fetch user phone numbers:', phoneError);
    res.status(500).json({ error: 'Failed to verify sender number.' });
    return;
  }

  const userNumbers = (phoneRows || []).map((row: { number: string }) => row.number.replace(/\D/g, ''));
  if (!userNumbers.includes(fromNumber.replace(/\D/g, ''))) {
    res.status(403).json({ error: 'You do not own this phone number.' });
    return;
  }

  try {
    console.log('Sending to Telnyx:', { from: fromNumber, to, text: messageBody });
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to,
        text: messageBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telnyx send error:', data);
      const errorDetail = data?.errors?.[0]?.detail || '';
      if (errorDetail.includes('messaging profile') && fromNumber) {
        console.log('[Telnyx] Number not associated with messaging profile, attempting auto-assign...');
        const assigned = await assignNumberToMessagingProfile(fromNumber);
        if (assigned) {
          console.log('[Telnyx] Retrying SMS send after profile assignment...');
          const retryResponse = await fetch('https://api.telnyx.com/v2/messages', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TELNYX_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromNumber,
              to,
              text: messageBody,
            }),
          });
          const retryData = await retryResponse.json();
          if (!retryResponse.ok) {
            console.error('Telnyx retry send error:', retryData);
            res.status(retryResponse.status).json({ error: retryData?.errors?.[0]?.detail || 'Telnyx request failed' });
            return;
          }
          const retryMessage = retryData.data;
          const retryRecord = {
            sid: retryMessage.id,
            from: retryMessage.from?.phone_number || fromNumber,
            to: retryMessage.to?.[0]?.phone_number || to,
            body: retryMessage.text || messageBody,
            direction: 'outbound' as const,
            dateCreated: retryMessage.received_at || new Date().toISOString(),
            status: retryMessage.to?.[0]?.status || 'queued',
          };
          await addMessage(retryRecord);
          console.log('Outbound SMS sent (after retry):', retryRecord);

          res.status(200).json({ sid: retryMessage.id, status: retryRecord.status, cost: smsCost });
          return;
        }
      }
      res.status(response.status).json({ error: errorDetail || 'Telnyx request failed' });
      return;
    }

    const message = data.data;
    const record = {
      sid: message.id,
      from: message.from?.phone_number || fromNumber,
      to: message.to?.[0]?.phone_number || to,
      body: message.text || messageBody,
      direction: 'outbound' as const,
      dateCreated: message.received_at || new Date().toISOString(),
      status: message.to?.[0]?.status || 'queued',
    };
    await addMessage(record);
    console.log('Outbound SMS sent:', record);

    // Charge coins for the SMS — try charge_sms RPC first, fall back to debit_tokens
    let charged = false;
    try {
      const { data: chargeResult, error: chargeError } = await serverClient.rpc('charge_sms', {
        p_user_id: userData.user.id,
        p_coins: smsCost,
        p_message_sid: message.id,
        p_direction: 'outbound',
        p_type: isMms ? 'mms' : 'sms',
        p_segments: segments,
      });

      if (chargeError) {
        console.warn('[Billing] charge_sms RPC failed, trying debit_tokens fallback:', chargeError.message);
      } else if (chargeResult === true) {
        charged = true;
        console.log(`[Billing] Charged ${smsCost} coins for outbound SMS`);
      }
    } catch (chargeErr) {
      console.warn('[Billing] charge_sms error, trying fallback:', chargeErr);
    }

    // Fallback: direct debit via debit_tokens + manual transaction log
    if (!charged) {
      try {
        const { data: debitResult } = await serverClient.rpc('debit_tokens', {
          p_user_id: userData.user.id,
          p_tokens: smsCost,
          p_reference: `SMS-${message.id}`,
        });

        if (debitResult === true) {
          await serverClient.from('transactions').insert({
            user_id: userData.user.id,
            reference: `SMS-${message.id}`,
            tokens: smsCost,
            amount_minor: 0,
            currency: 'COINS',
            provider: 'billing',
            status: 'success',
            metadata: {
              billing_type: 'sms',
              billing_direction: 'debit',
              message_sid: message.id,
              direction: 'outbound',
              type: isMms ? 'mms' : 'sms',
              segments,
              cost_coins: smsCost,
            },
          });
          charged = true;
          console.log(`[Billing] Fallback charged ${smsCost} coins for SMS`);
        } else {
          console.warn(`[Billing] SMS debit failed: insufficient balance (${smsCost} coins)`);
        }
      } catch (debitErr) {
        console.error('[Billing] SMS fallback debit error:', debitErr);
      }
    }

    // Try to log to messages_log (table may not exist yet)
    try {
      await serverClient.from('messages_log').insert({
        user_id: userData.user.id,
        message_sid: message.id,
        direction: 'outbound',
        type: isMms ? 'mms' : 'sms',
        segments,
        from_number: fromNumber,
        to_number: to,
        cost_coins: smsCost,
        status: 'sent',
      });
    } catch (logErr) {
      console.warn('[Billing] messages_log insert failed (table may not exist):', logErr);
    }

    res.status(200).json({ sid: message.id, status: record.status, cost: smsCost });
  } catch (err) {
    const error = err as Error;
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
