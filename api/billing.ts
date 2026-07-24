import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';
import { NUMBER_SUBSCRIPTION_COINS } from '../lib/billing.js';

// Combined billing + support endpoint:
//   GET  /api/billing?action=wallet        → user wallet balance
//   GET  /api/billing?action=transactions  → paginated transaction ledger
//   POST /api/billing?action=subscription  → cron job for subscription renewal
//   GET  /api/billing?action=ticket-list   → user's support tickets
//   GET  /api/billing?action=ticket-detail → single ticket with replies
//   POST /api/billing?action=ticket-create → create a support ticket
//   POST /api/billing?action=ticket-reply  → reply to a support ticket

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = (req.query.action as string) || 'wallet';
  const serverClient = supabaseServer();

  // --- Subscription check (POST, cron-only) ---
  if (action === 'subscription') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (provided !== cronSecret) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }
    }

    // Find all numbers where next_billing_date has passed
    const { data: expiredNumbers, error: fetchError } = await serverClient
      .from('phone_numbers')
      .select('id, user_id, number, billing_status, next_billing_date')
      .lt('next_billing_date', new Date().toISOString())
      .eq('billing_status', 'active');

    if (fetchError) {
      console.error('Failed to fetch expired subscriptions:', fetchError.message);
      res.status(500).json({ error: fetchError.message });
      return;
    }

    const results: Array<{ number: string; status: string }> = [];

    for (const entry of expiredNumbers || []) {
      const { data: chargeResult, error: chargeError } = await serverClient.rpc('charge_subscription', {
        p_user_id: entry.user_id,
        p_coins: NUMBER_SUBSCRIPTION_COINS,
        p_phone_number: entry.number,
      });

      if (chargeError || chargeResult !== true) {
        // Insufficient balance — suspend the number
        await serverClient
          .from('phone_numbers')
          .update({ billing_status: 'suspended', active: false })
          .eq('id', entry.id);

        results.push({ number: entry.number, status: 'suspended' });
        console.log(`Number ${entry.number} suspended due to insufficient balance`);
      } else {
        results.push({ number: entry.number, status: 'renewed' });
        console.log(`Number ${entry.number} renewed for 30 days`);
      }
    }

    res.status(200).json({ processed: results.length, results });
    return;
  }

  // --- Wallet & Transactions (GET, require auth) ---
  if (action !== 'ticket-list' && action !== 'ticket-detail' && action !== 'ticket-create' && action !== 'ticket-reply') {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return;
  }

  const { data: userData, error: authError } = await serverClient.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  // --- Wallet ---
  if (action === 'wallet') {
    const { data: wallet, error: walletError } = await serverClient
      .from('user_balances')
      .select('tokens, locked_balance, updated_at')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (walletError) {
      // Fallback: select only tokens (locked_balance column may not exist)
      const { data: walletBasic, error: basicError } = await serverClient
        .from('user_balances')
        .select('tokens, updated_at')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (basicError) {
        res.status(500).json({ error: basicError.message });
        return;
      }

      res.status(200).json({
        balance: walletBasic?.tokens || 0,
        lockedBalance: 0,
        availableBalance: walletBasic?.tokens || 0,
        updatedAt: walletBasic?.updated_at || null,
      });
      return;
    }

    res.status(200).json({
      balance: wallet?.tokens || 0,
      lockedBalance: wallet?.locked_balance || 0,
      availableBalance: (wallet?.tokens || 0) - (wallet?.locked_balance || 0),
      updatedAt: wallet?.updated_at || null,
    });
    return;
  }

  // --- Transactions ---
  if (action === 'transactions') {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    let query = serverClient
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by billing_type in metadata if provided (since billing_type column may not exist)
    const billingType = req.query.type as string | undefined;
    if (billingType) {
      query = query.eq('billing_type', billingType);
    }

    const { data: transactions, error: txError, count } = await query;

    if (txError) {
      res.status(500).json({ error: txError.message });
      return;
    }

    res.status(200).json({
      transactions: transactions || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
    return;
  }

  // --- Support Tickets (require auth) ---
  if (action.startsWith('ticket-')) {
    // Re-authenticate for support endpoints (userData already available from above if GET)
    // For POST, we need to authenticate here since the GET-only check above may have returned 405
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const supportToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!supportToken) {
      res.status(401).json({ error: 'Missing authorization token.' });
      return;
    }

    const { data: supportUser, error: supportAuthError } = await serverClient.auth.getUser(supportToken);
    if (supportAuthError || !supportUser.user) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    try {
      // ticket-list
      if (action === 'ticket-list' && req.method === 'GET') {
        const { data: tickets, error } = await serverClient
          .from('support_tickets')
          .select('*')
          .eq('user_id', supportUser.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[billing/ticket-list] Error:', error.message);
          res.status(500).json({ error: error.message });
          return;
        }

        res.status(200).json({ tickets: tickets || [] });
        return;
      }

      // ticket-detail
      if (action === 'ticket-detail' && req.method === 'GET') {
        const ticketId = req.query.id as string;
        if (!ticketId) {
          res.status(400).json({ error: 'Missing ticket id.' });
          return;
        }

        const { data: ticket, error: ticketError } = await serverClient
          .from('support_tickets')
          .select('*')
          .eq('id', ticketId)
          .eq('user_id', supportUser.user.id)
          .maybeSingle();

        if (ticketError) {
          console.error('[billing/ticket-detail] Error:', ticketError.message);
          res.status(500).json({ error: ticketError.message });
          return;
        }

        if (!ticket) {
          res.status(404).json({ error: 'Ticket not found.' });
          return;
        }

        const { data: replies, error: repliesError } = await serverClient
          .from('support_ticket_replies')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (repliesError) {
          console.error('[billing/ticket-detail] Replies error:', repliesError.message);
        }

        res.status(200).json({ ticket, replies: replies || [] });
        return;
      }

      // ticket-create
      if (action === 'ticket-create' && req.method === 'POST') {
        const { subject, category, priority, message } = req.body || {};
        if (!subject || !message) {
          res.status(400).json({ error: 'Subject and message are required.' });
          return;
        }

        const validCategories = ['general', 'billing', 'technical', 'abuse'];
        const validPriorities = ['low', 'normal', 'high', 'urgent'];

        const { data: ticket, error } = await serverClient
          .from('support_tickets')
          .insert({
            user_id: supportUser.user.id,
            subject: subject.trim(),
            category: validCategories.includes(category) ? category : 'general',
            priority: validPriorities.includes(priority) ? priority : 'normal',
            status: 'open',
            message: message.trim(),
          })
          .select('*')
          .single();

        if (error) {
          console.error('[billing/ticket-create] Error:', error.message);
          res.status(500).json({ error: error.message });
          return;
        }

        res.status(200).json({ ticket });
        return;
      }

      // ticket-reply
      if (action === 'ticket-reply' && req.method === 'POST') {
        const { ticketId, message } = req.body || {};
        if (!ticketId || !message) {
          res.status(400).json({ error: 'ticketId and message are required.' });
          return;
        }

        const { data: ticket, error: ticketError } = await serverClient
          .from('support_tickets')
          .select('id, status')
          .eq('id', ticketId)
          .eq('user_id', supportUser.user.id)
          .maybeSingle();

        if (ticketError || !ticket) {
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
            user_id: supportUser.user.id,
            author_role: 'user',
            message: message.trim(),
          })
          .select('*')
          .single();

        if (error) {
          console.error('[billing/ticket-reply] Error:', error.message);
          res.status(500).json({ error: error.message });
          return;
        }

        await serverClient
          .from('support_tickets')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', ticketId);

        res.status(200).json({ reply });
        return;
      }

      res.status(400).json({ error: 'Unknown ticket action.' });
      return;
    } catch (err) {
      const error = err as Error;
      console.error('[billing/ticket] Error:', error);
      res.status(500).json({ error: error.message });
      return;
    }
  }

  res.status(400).json({ error: 'Unknown action. Use: wallet, transactions, subscription, ticket-list, ticket-detail, ticket-create, or ticket-reply.' });
}
