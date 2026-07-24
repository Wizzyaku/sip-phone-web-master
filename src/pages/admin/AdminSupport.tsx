import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';
import { cn } from '../../lib/utils';

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  author_role: string;
  message: string;
  created_at: string;
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'abuse', label: 'Abuse' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    closed: 'bg-slate-200 text-slate-600',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase', colors[status] || colors.open)}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', colors[priority] || colors.normal)}>
      {priority}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getCategoryLabel(value: string): string {
  return categories.find((c) => c.value === value)?.label || value;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const replyScrollRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('No active session.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const queryString = params.toString();
      const res = await axios.get(`/api/admin?action=tickets${queryString ? `&${queryString}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(res.data.tickets || []);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load tickets.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filtered = tickets.filter((t) => {
    const matchesSearch = !search ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.user_email || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const openTicketDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDrawerOpen(true);
    setDetailLoading(true);
    setReplies([]);
    setReplyText('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await axios.get(`/api/admin?action=ticket-detail&id=${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTicket(res.data.ticket);
      setReplies(res.data.replies || []);
    } catch (err) {
      console.error('Failed to load ticket detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    replyScrollRef.current?.scrollTo({ top: replyScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [replies.length]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      await axios.post(
        '/api/admin?action=ticket-reply',
        { ticketId: selectedTicket.id, message: replyText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyText('');
      // Refresh replies
      const res = await axios.get(`/api/admin?action=ticket-detail&id=${selectedTicket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTicket(res.data.ticket);
      setReplies(res.data.replies || []);
      fetchTickets();
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleClose = async () => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      await axios.post(
        '/api/admin?action=ticket-close',
        { ticketId: selectedTicket.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const res = await axios.get(`/api/admin?action=ticket-detail&id=${selectedTicket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTicket(res.data.ticket);
      fetchTickets();
    } catch (err) {
      console.error('Failed to close ticket:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      await axios.post(
        '/api/admin?action=ticket-reopen',
        { ticketId: selectedTicket.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const res = await axios.get(`/api/admin?action=ticket-detail&id=${selectedTicket.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTicket(res.data.ticket);
      fetchTickets();
    } catch (err) {
      console.error('Failed to reopen ticket:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <AdminPage title="Support Tickets" subtitle="Manage user support requests">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        </AdminPage>
      </div>
    );
  }

  return (
    <>
      <AdminPage title="Support Tickets" subtitle="Manage user support requests">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject, user name, or email..."
            className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Tickets table */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Subject</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Category</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Priority</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filtered.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openTicketDetail(ticket)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 line-clamp-1">{ticket.subject}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{ticket.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{ticket.user_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{ticket.user_email || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {getCategoryLabel(ticket.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(ticket.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPage>

      {/* Detail drawer */}
      {drawerOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-800">{selectedTicket.subject}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {getCategoryLabel(selectedTicket.category)}
                    </span>
                    <PriorityBadge priority={selectedTicket.priority} />
                    <StatusBadge status={selectedTicket.status} />
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                <span className="font-semibold">User:</span> {selectedTicket.user_name || 'Unknown'}
                {selectedTicket.user_email && ` (${selectedTicket.user_email})`}
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              </div>
            ) : (
              <>
                {/* Conversation thread */}
                <div ref={replyScrollRef} className="space-y-3 p-4 pb-32">
                  {/* Original message */}
                  <div className="rounded-xl rounded-tl-sm bg-slate-100 px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 mb-1">
                      {selectedTicket.user_name || 'User'}
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                    <p className="mt-2 text-[10px] text-slate-400">{formatDate(selectedTicket.created_at)}</p>
                  </div>

                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={cn(
                        'flex',
                        reply.author_role === 'admin' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-xl px-4 py-3',
                          reply.author_role === 'admin'
                            ? 'rounded-tr-sm bg-indigo-600 text-white'
                            : 'rounded-tl-sm bg-slate-100'
                        )}
                      >
                        <p className={cn('text-xs font-bold mb-1', reply.author_role === 'admin' ? 'text-indigo-100' : 'text-slate-500')}>
                          {reply.author_role === 'admin' ? 'Admin' : selectedTicket.user_name || 'User'}
                        </p>
                        <p className={cn('text-sm whitespace-pre-wrap', reply.author_role === 'admin' ? 'text-white' : 'text-slate-700')}>
                          {reply.message}
                        </p>
                        <p className={cn('mt-2 text-[10px]', reply.author_role === 'admin' ? 'text-indigo-200' : 'text-slate-400')}>
                          {formatDate(reply.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action bar */}
                <div className="sticky bottom-0 border-t border-slate-200/80 bg-white p-3">
                  {selectedTicket.status !== 'closed' ? (
                    <>
                      <form onSubmit={handleReply} className="mb-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          rows={2}
                          className="mb-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={handleClose}
                            disabled={actionLoading}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          >
                            {actionLoading ? 'Closing...' : 'Close Ticket'}
                          </button>
                          <button
                            type="submit"
                            disabled={sendingReply || !replyText.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                          >
                            {sendingReply ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <span className="material-symbols-outlined text-sm">send</span>
                            )}
                            Send Reply
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-400">This ticket is closed</p>
                      <button
                        onClick={handleReopen}
                        disabled={actionLoading}
                        className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {actionLoading ? 'Reopening...' : 'Reopen Ticket'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
