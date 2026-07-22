import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface PhoneNumber {
  id: string;
  number: string;
  label: string;
  flag: string;
  features: string[];
  active: boolean;
  forwarding: string | null;
  voicemail: boolean;
  monthlyCost: number;
  assignedUser: string | null;
  assignedUserId: string | null;
  createdAt: string;
}

interface NumbersData {
  totalNumbers: number;
  activeNumbers: number;
  unassignedNumbers: number;
  pendingNumbers: number;
  numbers: PhoneNumber[];
}

function StatusBadge({ active, assigned }: { active: boolean; assigned: boolean }) {
  if (!active && assigned) {
    return <span className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-bold uppercase">Pending</span>;
  }
  if (active && assigned) {
    return <span className="bg-[#00a651]/10 text-[#00a651] px-3 py-1 rounded-full text-xs font-bold uppercase">Active</span>;
  }
  if (!assigned) {
    return <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold uppercase">Unassigned</span>;
  }
  return <span className="bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold uppercase">Suspended</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminNumbers() {
  const [data, setData] = useState<NumbersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

        const res = await axios.get('/api/admin?action=numbers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load phone numbers.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredNumbers = useMemo(() => {
    if (!data) return [];
    return data.numbers.filter((n) => {
      const matchesSearch =
        !search ||
        n.number.replace(/\D/g, '').includes(search.replace(/\D/g, '')) ||
        (n.assignedUser || '').toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && n.active && n.assignedUserId) ||
        (statusFilter === 'unassigned' && !n.assignedUserId) ||
        (statusFilter === 'pending' && !n.active && n.assignedUserId);

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <AdminPage title="Phone Numbers" subtitle="Manage all phone numbers across the platform.">
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
                  <span className="material-symbols-outlined">dialer_sip</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Numbers</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.totalNumbers.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-[#00a651]/10 rounded-xl text-[#00a651]">
                  <span className="material-symbols-outlined">check_circle</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Active Numbers</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.activeNumbers.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-surface-container-high rounded-xl text-on-surface-variant">
                  <span className="material-symbols-outlined">unpublished</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Unassigned</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.unassignedNumbers.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
                  <span className="material-symbols-outlined">pending</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Pending</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.pendingNumbers.toLocaleString()}</h3>
              </div>
            </div>
          </div>

          <div className="admin-card-lg !p-0 overflow-hidden border border-white/20">
            <div className="px-md py-sm border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm bg-white/30">
              <h4 className="font-headline-md text-headline-md text-on-surface">All Phone Numbers</h4>
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
                    className="w-full sm:w-64 bg-surface-container-low border-none rounded-lg py-1.5 pl-9 pr-3 text-label-md focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg text-label-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left">Phone Number</th>
                    <th className="text-left">Assigned User</th>
                    <th className="text-left">Features</th>
                    <th className="text-left">Monthly Cost</th>
                    <th className="text-left">Acquired</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredNumbers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center !py-md">
                        No phone numbers found.
                      </td>
                    </tr>
                  )}
                  {filteredNumbers.map((n) => (
                    <tr key={n.id} className="hover:bg-primary/5 transition-colors cursor-pointer group">
                      <td>
                        <div className="flex items-center gap-sm">
                          <span className="text-lg">{n.flag}</span>
                          <span className="font-body-md font-medium text-on-surface">{n.number}</span>
                          {n.label && (
                            <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                              {n.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {n.assignedUser ? (
                          <span className="font-body-md font-medium text-on-surface">{n.assignedUser}</span>
                        ) : (
                          <span className="text-on-surface-variant text-sm italic">Not assigned</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {n.features.map((f) => (
                            <span
                              key={f}
                              className="text-xs font-bold uppercase bg-primary/5 text-primary px-2 py-0.5 rounded-full"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="font-body-md text-on-surface-variant">
                        ${n.monthlyCost.toFixed(2)}
                      </td>
                      <td className="text-on-surface-variant text-sm">
                        {formatDate(n.createdAt)}
                      </td>
                      <td className="text-right">
                        <StatusBadge active={n.active} assigned={!!n.assignedUserId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
}
