import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface Call {
  id: string;
  from: string;
  to: string;
  remoteIdentity: string;
  direction: 'inbound' | 'outbound';
  durationSeconds: number;
  recorded: boolean;
  createdAt: string;
  user: string | null;
}

interface CallsData {
  total: number;
  inbound: number;
  outbound: number;
  totalDuration: number;
  calls: Call[];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminCalls() {
  const [data, setData] = useState<CallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

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

        const res = await axios.get('/api/admin?action=calls', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load call logs.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredCalls = useMemo(() => {
    if (!data) return [];
    return data.calls.filter((c) => {
      const matchesSearch =
        !search ||
        c.remoteIdentity.replace(/\D/g, '').includes(search.replace(/\D/g, '')) ||
        (c.user || '').toLowerCase().includes(search.toLowerCase());

      const matchesDirection =
        directionFilter === 'all' ||
        (directionFilter === 'inbound' && c.direction === 'inbound') ||
        (directionFilter === 'outbound' && c.direction === 'outbound');

      return matchesSearch && matchesDirection;
    });
  }, [data, search, directionFilter]);

  return (
    <AdminPage title="Call Logs" subtitle="Monitor all call activity across the platform.">
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
                  <span className="material-symbols-outlined">call</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Calls</span>
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
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <span className="material-symbols-outlined">timer</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Duration</span>
                <h3 className="text-[28px] font-bold text-on-surface">{formatDuration(data.totalDuration)}</h3>
              </div>
            </div>
          </div>

          <div className="admin-card-lg !p-0 overflow-hidden border border-white/20">
            <div className="px-md py-sm border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm bg-white/30">
              <h4 className="font-headline-md text-headline-md text-on-surface">All Calls</h4>
              <div className="flex items-center gap-sm w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search number or user..."
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
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left">Direction</th>
                    <th className="text-left">Remote Number</th>
                    <th className="text-left">Duration</th>
                    <th className="text-left">Recorded</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredCalls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center !py-md">
                        No call logs found.
                      </td>
                    </tr>
                  )}
                  {filteredCalls.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCall(c)}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                    >
                      <td>
                        <div className="flex items-center gap-1">
                          <span
                            className={`material-symbols-outlined text-lg ${
                              c.direction === 'inbound' ? 'text-secondary' : 'text-tertiary'
                            }`}
                          >
                            {c.direction === 'inbound' ? 'arrow_downward' : 'arrow_upward'}
                          </span>
                          <span className="text-xs font-bold uppercase text-on-surface-variant">{c.direction}</span>
                        </div>
                      </td>
                      <td className="font-body-md font-medium text-on-surface">{c.remoteIdentity || '—'}</td>
                      <td className="text-on-surface-variant text-sm">{formatDuration(c.durationSeconds)}</td>
                      <td>
                        {c.recorded ? (
                          <span className="material-symbols-outlined text-primary text-lg">mic</span>
                        ) : (
                          <span className="text-on-surface-variant text-sm">—</span>
                        )}
                      </td>
                      <td className="text-on-surface-variant text-sm">{formatDateTime(c.createdAt)}</td>
                      <td className="font-body-md text-on-surface-variant text-sm">{c.user || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedCall && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedCall(null)}
            >
              <div
                className="admin-card-lg max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-md">
                  <h4 className="font-headline-md text-headline-md text-on-surface">Call Details</h4>
                  <button
                    onClick={() => setSelectedCall(null)}
                    className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors"
                  >
                    close
                  </button>
                </div>
                <div className="space-y-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Direction</span>
                    <span className="font-body-md font-semibold text-on-surface uppercase">{selectedCall.direction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Remote Number</span>
                    <span className="font-body-md font-medium text-on-surface">{selectedCall.remoteIdentity || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Duration</span>
                    <span className="font-body-md text-on-surface">{formatDuration(selectedCall.durationSeconds)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Recorded</span>
                    <span className="font-body-md text-on-surface">{selectedCall.recorded ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Date</span>
                    <span className="font-body-md text-on-surface">{formatDateTime(selectedCall.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">User</span>
                    <span className="font-body-md text-on-surface">{selectedCall.user || '—'}</span>
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
