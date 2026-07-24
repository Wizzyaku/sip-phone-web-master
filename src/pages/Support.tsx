import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { cn } from '../lib/utils';
import {
  HelpCircle,
  Plus,
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

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
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'abuse', label: 'Report Abuse' },
];

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof Clock; label: string }> = {
    open: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', icon: CheckCircle, label: 'Open' },
    pending: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', icon: Clock, label: 'Pending' },
    closed: { color: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: XCircle, label: 'Closed' },
  };
  const c = config[status] || config.open;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase', c.color)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    normal: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
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

export default function Support() {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DesktopSupport />;
  }
  return <MobileSupport />;
}

// ===================== DESKTOP =====================

function DesktopSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTickets = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('You must be signed in.');
        setLoading(false);
        return;
      }
      const res = await axios.get(`${API_URL}/billing?action=ticket-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(res.data.tickets || []);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load tickets.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filtered = tickets.filter((t) => {
    const matchesSearch = !search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreated = () => {
    setShowNewForm(false);
    fetchTickets();
  };

  const handleReplySent = () => {
    fetchTickets();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Help &amp; Support</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Submit a ticket and track your requests</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Ticket list */}
        <div className="flex w-[380px] shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/50 dark:bg-slate-900">
          <div className="border-b border-slate-200/80 p-3 dark:border-slate-700/50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <div className="mt-2 flex gap-1.5">
              {['all', 'open', 'pending', 'closed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold capitalize transition-colors',
                    statusFilter === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HelpCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-semibold text-slate-400">No tickets found</p>
                <p className="text-xs text-slate-400">Create a new ticket to get help</p>
              </div>
            ) : (
              filtered.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className={cn(
                    'w-full border-b border-slate-100 p-3 text-left transition-colors dark:border-slate-800',
                    selectedId === ticket.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{ticket.subject}</h3>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ticket.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {getCategoryLabel(ticket.category)}
                    </span>
                    <PriorityBadge priority={ticket.priority} />
                    <span className="ml-auto text-[10px] text-slate-400">{formatDate(ticket.created_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail / New form */}
        <div className="flex flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/50 dark:bg-slate-900">
          {showNewForm ? (
            <NewTicketForm onCancel={() => setShowNewForm(false)} onCreated={handleCreated} />
          ) : selectedId ? (
            <TicketDetail ticketId={selectedId} onReplySent={handleReplySent} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MessageSquare className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-4 text-sm font-bold text-slate-500">Select a ticket to view details</p>
              <p className="text-xs text-slate-400">or create a new ticket</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTicketForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('You must be signed in.');
        setSubmitting(false);
        return;
      }
      await axios.post(
        `${API_URL}/billing?action=ticket-create`,
        { subject: subject.trim(), category, priority, message: message.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onCreated();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to create ticket.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-slate-200/80 p-4 dark:border-slate-700/50">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Create New Ticket</h2>
        <p className="text-sm text-slate-500">Fill out the form below and we&apos;ll get back to you</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue in detail..."
            rows={6}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Ticket
          </button>
        </div>
      </form>
    </div>
  );
}

function TicketDetail({ ticketId, onReplySent }: { ticketId: string; onReplySent: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await axios.get(`${API_URL}/billing?action=ticket-detail&id=${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTicket(res.data.ticket);
      setReplies(res.data.replies || []);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load ticket.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [replies.length]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || ticket?.status === 'closed') return;
    setSending(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      await axios.post(
        `${API_URL}/billing?action=ticket-reply`,
        { ticketId, message: replyText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyText('');
      await fetchDetail();
      onReplySent();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to send reply.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Ticket not found</div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-200/80 p-4 dark:border-slate-700/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{ticket.subject}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {getCategoryLabel(ticket.category)}
              </span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Original message */}
        <div className="flex flex-col">
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">You</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{ticket.message}</p>
            <p className="mt-2 text-[10px] text-slate-400">{formatDate(ticket.created_at)}</p>
          </div>
        </div>

        {/* Replies */}
        {replies.map((reply) => (
          <div key={reply.id} className={cn('flex', reply.author_role === 'admin' ? 'justify-start' : 'justify-end')}>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3',
              reply.author_role === 'admin'
                ? 'rounded-tl-sm bg-indigo-50 dark:bg-indigo-950/30'
                : 'rounded-tr-sm bg-indigo-600 text-white'
            )}>
              <p className={cn('text-xs font-bold mb-1', reply.author_role === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-100')}>
                {reply.author_role === 'admin' ? 'Support Team' : 'You'}
              </p>
              <p className={cn('text-sm whitespace-pre-wrap', reply.author_role === 'admin' ? 'text-slate-700 dark:text-slate-200' : 'text-white')}>
                {reply.message}
              </p>
              <p className={cn('mt-2 text-[10px]', reply.author_role === 'admin' ? 'text-slate-400' : 'text-indigo-200')}>
                {formatDate(reply.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' ? (
        <form onSubmit={handleReply} className="border-t border-slate-200/80 p-3 dark:border-slate-700/50">
          {error && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-slate-200/80 p-3 text-center dark:border-slate-700/50">
          <p className="text-sm font-semibold text-slate-400">This ticket is closed</p>
        </div>
      )}
    </div>
  );
}

// ===================== MOBILE =====================

function MobileSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail' | 'new'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTickets = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('You must be signed in.');
        setLoading(false);
        return;
      }
      const res = await axios.get(`${API_URL}/billing?action=ticket-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(res.data.tickets || []);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load tickets.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filtered = tickets.filter((t) => statusFilter === 'all' || t.status === statusFilter);

  const handleOpenTicket = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedId(null);
    fetchTickets();
  };

  const handleCreated = () => {
    setView('list');
    fetchTickets();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center pt-16">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (view === 'new') {
    return <MobileNewTicketForm onBack={handleCreated} onCancel={() => setView('list')} />;
  }

  if (view === 'detail' && selectedId) {
    return <MobileTicketDetail ticketId={selectedId} onBack={handleBack} />;
  }

  return (
    <div className="flex h-full flex-col pt-14 pb-28">
      {/* Header */}
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Support</h1>
            <p className="text-[11px] text-slate-500">Submit &amp; track your tickets</p>
          </div>
          <button
            onClick={() => setView('new')}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pb-2">
        {['all', 'open', 'pending', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-md px-2 py-1 text-[10px] font-bold capitalize transition-colors',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <HelpCircle className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-xs font-bold text-slate-400">No tickets yet</p>
            <p className="text-[10px] text-slate-400">Tap &quot;New&quot; to create one</p>
          </div>
        ) : (
          filtered.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => handleOpenTicket(ticket.id)}
              className="w-full rounded-xl border border-slate-200/80 bg-white p-2.5 text-left transition-colors active:scale-[0.98] dark:border-slate-700/50 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-1.5">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{ticket.subject}</h3>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{ticket.message}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {getCategoryLabel(ticket.category)}
                </span>
                <PriorityBadge priority={ticket.priority} />
                <span className="ml-auto text-[9px] text-slate-400">{formatDate(ticket.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MobileNewTicketForm({ onCancel, onBack }: { onCancel: () => void; onBack: () => void }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('You must be signed in.');
        setSubmitting(false);
        return;
      }
      await axios.post(
        `${API_URL}/billing?action=ticket-create`,
        { subject: subject.trim(), category, priority, message: message.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onBack();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to create ticket.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col pt-14 pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">New Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-3 space-y-2.5">
        {error && (
          <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue..."
            rows={5}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Submit Ticket
        </button>
      </form>
    </div>
  );
}

function MobileTicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await axios.get(`${API_URL}/billing?action=ticket-detail&id=${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTicket(res.data.ticket);
      setReplies(res.data.replies || []);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load ticket.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [replies.length]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || ticket?.status === 'closed') return;
    setSending(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      await axios.post(
        `${API_URL}/billing?action=ticket-reply`,
        { ticketId, message: replyText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyText('');
      await fetchDetail();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to send reply.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center pt-16">
        <p className="text-sm text-slate-500">Ticket not found</p>
        <button onClick={onBack} className="mt-3 text-xs font-bold text-indigo-600">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col pt-14 pb-28">
      {/* Header */}
      <div className="px-3 pb-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1">{ticket.subject}</h1>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {getCategoryLabel(ticket.category)}
          </span>
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 space-y-2">
        <div className="flex flex-col">
          <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">You</p>
            <p className="text-[11px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{ticket.message}</p>
            <p className="mt-1 text-[9px] text-slate-400">{formatDate(ticket.created_at)}</p>
          </div>
        </div>
        {replies.map((reply) => (
          <div key={reply.id} className={cn('flex', reply.author_role === 'admin' ? 'justify-start' : 'justify-end')}>
            <div className={cn(
              'max-w-[85%] rounded-xl px-3 py-2',
              reply.author_role === 'admin'
                ? 'rounded-tl-sm bg-indigo-50 dark:bg-indigo-950/30'
                : 'rounded-tr-sm bg-indigo-600 text-white'
            )}>
              <p className={cn('text-[10px] font-bold mb-0.5', reply.author_role === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-100')}>
                {reply.author_role === 'admin' ? 'Support Team' : 'You'}
              </p>
              <p className={cn('text-[11px] whitespace-pre-wrap', reply.author_role === 'admin' ? 'text-slate-700 dark:text-slate-200' : 'text-white')}>
                {reply.message}
              </p>
              <p className={cn('mt-1 text-[9px]', reply.author_role === 'admin' ? 'text-slate-400' : 'text-indigo-200')}>
                {formatDate(reply.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      {ticket.status !== 'closed' ? (
        <form onSubmit={handleReply} className="fixed bottom-0 left-0 right-0 border-t border-slate-200/80 bg-white p-2 dark:border-slate-700/50 dark:bg-slate-900">
          {error && (
            <div className="mb-1.5 flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white active:scale-95 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </form>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/80 bg-white p-2 text-center dark:border-slate-700/50 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-400">This ticket is closed</p>
        </div>
      )}
    </div>
  );
}
