import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabase-server.js';

export const config = {
  api: {
    bodyParser: true,
  },
};

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

  const action = (req.query.action as string) || 'list';

  try {
    if (req.method === 'GET') {
      if (action === 'list') {
        const { data: tickets, error } = await serverClient
          .from('support_tickets')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[support/list] Error:', error.message);
          res.status(500).json({ error: error.message });
          return;
        }

        res.status(200).json({ tickets: tickets || [] });
        return;
      }

      if (action === 'detail') {
        const ticketId = req.query.id as string;
        if (!ticketId) {
          res.status(400).json({ error: 'Missing ticket id.' });
          return;
        }

        const { data: ticket, error: ticketError } = await serverClient
          .from('support_tickets')
          .select('*')
          .eq('id', ticketId)
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (ticketError) {
          console.error('[support/detail] Ticket error:', ticketError.message);
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
          console.error('[support/detail] Replies error:', repliesError.message);
        }

        res.status(200).json({ ticket, replies: replies || [] });
        return;
      }

      res.status(400).json({ error: 'Unknown action. Use: list or detail.' });
      return;
    }

    // POST
    if (action === 'create') {
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
          user_id: userData.user.id,
          subject: subject.trim(),
          category: validCategories.includes(category) ? category : 'general',
          priority: validPriorities.includes(priority) ? priority : 'normal',
          status: 'open',
          message: message.trim(),
        })
        .select('*')
        .single();

      if (error) {
        console.error('[support/create] Error:', error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ ticket });
      return;
    }

    if (action === 'reply') {
      const { ticketId, message } = req.body || {};
      if (!ticketId || !message) {
        res.status(400).json({ error: 'ticketId and message are required.' });
        return;
      }

      // Verify ownership
      const { data: ticket, error: ticketError } = await serverClient
        .from('support_tickets')
        .select('id, status')
        .eq('id', ticketId)
        .eq('user_id', userData.user.id)
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
          user_id: userData.user.id,
          author_role: 'user',
          message: message.trim(),
        })
        .select('*')
        .single();

      if (error) {
        console.error('[support/reply] Error:', error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      // Update ticket status to pending and bump updated_at
      await serverClient
        .from('support_tickets')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      res.status(200).json({ reply });
      return;
    }

    res.status(400).json({ error: 'Unknown action. Use: create or reply.' });
  } catch (err) {
    const error = err as Error;
    console.error('[support] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
