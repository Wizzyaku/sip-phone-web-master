import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/appStore';
import {
  HelpCircle,
  Plus,
  X,
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

function MobileStatusPill({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    open: { cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', label: 'Open' },
    pending: { cls: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Pending' },
    closed: { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Resolved' },
  };
  const c = cfg[status] || cfg.open;
  return <span className={cn('inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide', c.cls)}>{c.label}</span>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MobileSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const setActiveTicketThread = useAppStore((s) => s.setActiveTicketThread);

  useEffect(() => {
    return () => { setActiveTicketThread(null); };
  }, [setActiveTicketThread]);

  const fetchTickets = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('You must be signed in.'); setLoading(false); return; }
      const res = await axios.get(`${API_URL}/billing?action=ticket-list`, { headers: { Authorization: `Bearer ${token}` } });
      setTickets(res.data.tickets || []);
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load tickets.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filtered = tickets.filter((t) => {
    const ms = !search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all' || t.status === statusFilter;
    return ms && mf;
  });

  const handleBack = () => { setSelectedId(null); setActiveTicketThread(null); fetchTickets(); };
  const handleCreated = () => { setShowNewSheet(false); fetchTickets(); };

  const tabs = [
    { id: 'all', label: 'All Tickets' },
    { id: 'open', label: 'Open', dot: 'bg-emerald-500' },
    { id: 'pending', label: 'Pending', dot: 'bg-amber-500' },
    { id: 'closed', label: 'Resolved', dot: 'bg-slate-300' },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#F0F4F8] dark:bg-slate-950">
      {/* TICKET LIST */}
      <div className={cn('absolute inset-0 flex flex-col transition-transform duration-300', selectedId && 'translate-x-[-100%]')}>
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 pb-2.5 pt-2 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/90">
          <h1 className="text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Support Center</h1>
        </header>

        <div className="no-scrollbar flex-grow overflow-y-auto px-4 pb-28 pt-3">
          <div className="mb-3 flex flex-col gap-3">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" /></svg>
              </span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ticket ID or subject..."
                className="h-11 w-full rounded-[14px] border border-slate-200 bg-white pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setStatusFilter(t.id)}
                  className={cn('flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] font-bold shadow-sm transition-all active:scale-95',
                    statusFilter === t.id ? 'bg-slate-800 text-white dark:bg-indigo-600' : 'border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400')}>
                  {t.dot && <span className={cn('h-2 w-2 rounded-full', t.dot)} />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}

          <h3 className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Recent Tickets</h3>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HelpCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-bold text-slate-400">No tickets found</p>
              <p className="text-xs text-slate-400">Create a new ticket to get help</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((ticket) => {
                const isOpen = ticket.status === 'open';
                return (
                  <button key={ticket.id} onClick={() => { setSelectedId(ticket.id); setActiveTicketThread(ticket.id); }}
                    className={cn('group relative flex cursor-pointer flex-col gap-2.5 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-3.5 text-left shadow-[0_4px_15px_rgba(15,23,42,0.03)] transition-colors active:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-900 dark:active:bg-slate-800',
                      ticket.status === 'closed' && 'opacity-75 hover:opacity-100')}>
                    {isOpen && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                    <div className={cn('flex items-start justify-between', isOpen && 'pl-1')}>
                      <div className="flex items-center gap-2">
                        <MobileStatusPill status={ticket.status} />
                        <span className="text-[10px] font-bold text-slate-400">#{ticket.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                    <div className={cn(isOpen && 'pl-1')}>
                      <h4 className="text-[14px] font-extrabold leading-tight text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-slate-100">{ticket.subject}</h4>
                      <p className="mt-1 truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">{ticket.message}</p>
                    </div>
                    <div className={cn('mt-0.5 flex items-center justify-between border-t border-slate-50 pt-2.5', isOpen && 'pl-1')}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 0 1-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7Z" /></svg>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{getCategoryLabel(ticket.category)}</span>
                      </div>
                      <span className="text-[9px] font-extrabold text-slate-400">{timeAgo(ticket.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={() => setShowNewSheet(true)}
          className="absolute bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-[18px] bg-indigo-600 text-white shadow-[0_8px_25px_rgba(79,70,229,0.4)] transition-transform active:scale-90 hover:bg-indigo-500">
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {selectedId && <MobileTicketThread ticketId={selectedId} onBack={handleBack} />}
      {showNewSheet && <MobileNewTicketSheet onClose={() => setShowNewSheet(false)} onCreated={handleCreated} />}
    </div>
  );
}

function MobileNewTicketSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
      if (!token) { setError('You must be signed in.'); setSubmitting(false); return; }
      await axios.post(`${API_URL}/billing?action=ticket-create`,
        { subject: subject.trim(), category, priority, message: message.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      onCreated();
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to create ticket.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="absolute inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[90dvh] flex-col rounded-t-[32px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:bg-slate-900">
        <div className="relative flex shrink-0 flex-col items-center border-b border-slate-100 px-5 pb-3 pt-3 dark:border-slate-700/50">
          <div className="mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          <h2 className="text-[16px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Create Support Ticket</h2>
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-transform active:scale-95 dark:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3.5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Category</label>
              <div className="relative w-full">
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="h-12 w-full appearance-none rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-[14px] font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 pointer-events-none">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Priority</label>
              <div className="relative w-full">
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="h-12 w-full appearance-none rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-[14px] font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 pointer-events-none">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of the issue"
                className="h-12 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Description</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Provide as much detail as possible..." rows={4}
                className="w-full resize-none rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" required />
            </div>
          </div>

          <div className="pt-4 pb-6">
            <button type="submit" disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-indigo-600 text-[14px] font-extrabold text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 disabled:opacity-50">
              {submitting ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
              Submit Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MobileTicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
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
      setError(axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

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
      await axios.post(`${API_URL}/billing?action=ticket-reply`,
        { ticketId, message: replyText.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      setReplyText('');
      await fetchDetail();
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-slate-950">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-slate-950">
        <p className="text-sm text-slate-500">Ticket not found</p>
        <button onClick={onBack} className="mt-3 text-xs font-bold text-indigo-600">Go back</button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[100] flex flex-col bg-[#F0F4F8] dark:bg-slate-950">
      {/* Thread Header */}
      <header className="z-20 shrink-0 border-b border-slate-200/80 bg-white/90 px-3 pb-2 pt-2 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/90">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="-ml-1 flex items-center rounded-full p-1 text-indigo-600 transition-colors hover:bg-indigo-50 active:scale-90 dark:hover:bg-indigo-950/30">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <MobileStatusPill status={ticket.status} />
        </div>
        <div className="mt-1 px-2 pb-1">
          <h2 className="text-[16px] font-extrabold leading-tight text-slate-800 dark:text-slate-100">{ticket.subject}</h2>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">Ticket #{ticket.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </header>

      {/* Thread Messages */}
      <div ref={scrollRef} className="no-scrollbar flex-grow overflow-y-auto px-4 py-5">
        {/* Original User Message */}
        <div className="flex w-full shrink-0 flex-col gap-1">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
              <span className="text-[10px] font-bold">You</span>
            </div>
            <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">You</span>
            <span className="ml-auto text-[9px] font-bold text-slate-400">{formatDate(ticket.created_at)}</span>
          </div>
          <div className="ml-8 rounded-[16px] rounded-br-sm border border-slate-200/60 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:border-slate-700/50 dark:bg-slate-800">
            <p className="text-[13px] font-medium leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{ticket.message}</p>
          </div>
        </div>

        {/* Replies */}
        {replies.map((reply) => (
          <div key={reply.id} className="mt-4 flex w-full shrink-0 flex-col gap-1">
            <div className="flex items-center gap-2 px-1">
              {reply.author_role === 'admin' ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 0 1-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7Z" /></svg>
                </div>
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <span className="text-[10px] font-bold">You</span>
                </div>
              )}
              <span className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                {reply.author_role === 'admin' ? 'Support' : 'You'}
                {reply.author_role === 'admin' && (
                  <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5 text-[8px] uppercase text-slate-500 dark:bg-slate-700">Agent</span>
                )}
              </span>
              <span className="ml-auto text-[9px] font-bold text-slate-400">{formatDate(reply.created_at)}</span>
            </div>
            <div className={cn(
              'ml-8 rounded-[16px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]',
              reply.author_role === 'admin'
                ? 'rounded-bl-sm border border-indigo-100/60 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-950/20'
                : 'rounded-br-sm border border-slate-200/60 bg-white dark:border-slate-700/50 dark:bg-slate-800'
            )}>
              <p className="text-[13px] font-medium leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{reply.message}</p>
            </div>
          </div>
        ))}

        <div className="h-2 shrink-0" />
      </div>

      {/* Reply Input Bar */}
      {ticket.status !== 'closed' ? (
        <form onSubmit={handleReply} className="shrink-0 border-t border-slate-200/80 bg-white/90 px-3 py-3 pb-3 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/90">
          {error && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="h-3 w-3 shrink-0" />{error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex min-h-[40px] flex-grow items-center rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={1}
                className="max-h-[100px] w-full resize-none border-none bg-transparent py-2 text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none dark:text-slate-200"
              />
            </div>
            <button type="submit" disabled={sending || !replyText.trim()}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90',
                replyText.trim()
                  ? 'bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
                  : 'bg-slate-200 text-white pointer-events-none dark:bg-slate-700'
              )}>
              {sending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </form>
      ) : (
        <div className="shrink-0 border-t border-slate-200/80 bg-white/90 px-3 py-3 pb-3 text-center backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/90">
          <p className="text-[12px] font-semibold text-slate-400">This ticket is closed</p>
        </div>
      )}
    </div>
  );
}
