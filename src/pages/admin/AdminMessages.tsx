import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface Message {
  sid: string;
  from: string;
  to: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  dateCreated: string;
}

interface MessagesData {
  total: number;
  inbound: number;
  outbound: number;
  failed: number;
  messages: Message[];
}

function MessageStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'delivered' || s === 'received' || s === 'sent') {
    return <span className="bg-[#00a651]/10 text-[#00a651] px-3 py-1 rounded-full text-xs font-bold uppercase">Delivered</span>;
  }
  if (s === 'failed' || s === 'error' || s === 'undelivered') {
    return <span className="bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold uppercase">Failed</span>;
  }
  if (s === 'read' || s === 'seen') {
    return <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase">Read</span>;
  }
  return <span className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-bold uppercase">Pending</span>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export default function AdminMessages() {
  const [data, setData] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setError('No active session.');
          setLoading(false);
          return;
        }

        const res = await axios.get('/api/admin?action=messages', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load messages.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredMessages = useMemo(() => {
    if (!data) return [];
    return data.messages.filter((m) => {
      const matchesSearch =
        !search ||
        m.from.replace(/\D/g, '').includes(search.replace(/\D/g, '')) ||
        m.to.replace(/\D/g, '').includes(search.replace(/\D/g, '')) ||
        m.body.toLowerCase().includes(search.toLowerCase());

      const matchesDirection =
        directionFilter === 'all' ||
        (directionFilter === 'inbound' && m.direction === 'inbound') ||
        (directionFilter === 'outbound' && m.direction === 'outbound');

      const s = m.status.toLowerCase();
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'delivered' && (s === 'delivered' || s === 'received' || s === 'sent')) ||
        (statusFilter === 'failed' && (s === 'failed' || s === 'error' || s === 'undelivered')) ||
        (statusFilter === 'pending' && s !== 'delivered' && s !== 'received' && s !== 'sent' && s !== 'failed' && s !== 'error' && s !== 'undelivered' && s !== 'read' && s !== 'seen');

      return matchesSearch && matchesDirection && matchesStatus;
    });
  }, [data, search, directionFilter, statusFilter]);

  return (
    <AdminPage title="Messages" subtitle="Monitor all SMS and MMS traffic across the platform.">
      {loading && (
        <div className="admin-card-lg admin-section text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="admin-card-lg admin-section text-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="admin-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 admin-section">
            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <span className="material-symbols-outlined">sms</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Messages</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.total.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                  <span className="material-symbols-outlined">arrow_downward</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Inbound</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.inbound.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-tertiary-container/10 rounded-xl text-tertiary">
                  <span className="material-symbols-outlined">arrow_upward</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Outbound</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.outbound.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-error/10 rounded-xl text-error">
                  <span className="material-symbols-outlined">error</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Failed</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.failed.toLocaleString()}</h3>
              </div>
            </div>
          </div>

          <div className="admin-card-lg !p-0 overflow-hidden border border-white/20">
            <div className="px-md py-sm border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm bg-white/30">
              <h4 className="font-headline-md text-headline-md text-on-surface">All Messages</h4>
              <div className="flex items-center gap-sm w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:flex-none">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search number or content..."
                    className="w-full sm:w-56 bg-surface-container-low border-none rounded-lg py-1.5 pl-9 pr-3 text-label-md focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <select
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg text-label-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">All Directions</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg text-label-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="delivered">Delivered</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left">Direction</th>
                    <th className="text-left">From</th>
                    <th className="text-left">To</th>
                    <th className="text-left">Message</th>
                    <th className="text-left">Date</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredMessages.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center !py-md">
                        No messages found.
                      </td>
                    </tr>
                  )}
                  {filteredMessages.map((m) => (
                    <tr
                      key={m.sid}
                      onClick={() => setSelectedMessage(m)}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                    >
                      <td>
                        <div className="flex items-center gap-1">
                          <span
                            className={`material-symbols-outlined text-lg ${
                              m.direction === 'inbound' ? 'text-secondary' : 'text-tertiary'
                            }`}
                          >
                            {m.direction === 'inbound' ? 'arrow_downward' : 'arrow_upward'}
                          </span>
                          <span className="text-xs font-bold uppercase text-on-surface-variant">
                            {m.direction}
                          </span>
                        </div>
                      </td>
                      <td className="font-body-md font-medium text-on-surface">{m.from}</td>
                      <td className="font-body-md font-medium text-on-surface">{m.to}</td>
                      <td className="text-on-surface-variant text-sm max-w-[200px] truncate">
                        {truncate(m.body, 50)}
                      </td>
                      <td className="text-on-surface-variant text-sm">
                        {formatDateTime(m.dateCreated)}
                      </td>
                      <td className="text-right">
                        <MessageStatusBadge status={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedMessage && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedMessage(null)}
            >
              <div
                className="admin-card-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-md">
                  <h4 className="font-headline-md text-headline-md text-on-surface">Message Details</h4>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors"
                  >
                    close
                  </button>
                </div>
                <div className="space-y-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Direction</span>
                    <span className="font-body-md font-semibold text-on-surface uppercase">{selectedMessage.direction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">From</span>
                    <span className="font-body-md font-medium text-on-surface">{selectedMessage.from}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">To</span>
                    <span className="font-body-md font-medium text-on-surface">{selectedMessage.to}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Status</span>
                    <MessageStatusBadge status={selectedMessage.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Date</span>
                    <span className="font-body-md text-on-surface">{formatDateTime(selectedMessage.dateCreated)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">SID</span>
                    <span className="font-mono text-xs text-on-surface-variant">{selectedMessage.sid}</span>
                  </div>
                  <div className="pt-sm border-t border-outline-variant/10">
                    <span className="text-on-surface-variant text-label-md block mb-sm">Message Body</span>
                    <p className="font-body-md text-on-surface whitespace-pre-wrap break-words">{selectedMessage.body}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}
