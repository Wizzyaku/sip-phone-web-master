import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface AdminStats {
  totalUsers: number;
  activeNumbers: number;
  pendingApprovals: number;
  revenue: { value: number; currency: string };
  recentActivity: {
    id: string;
    admin: string;
    initials: string;
    action: string;
    entity: string;
    timestamp: string;
    status: string;
  }[];
}

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatCurrency(value: number, currency: string): string {
  const symbol = currency === 'NGN' ? '\u20a6' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0).replace(/[\d.,]/g, '');
  if (value >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`;
  }
  if (currency === 'NGN') {
    return `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status).toLowerCase();
  if (normalized === 'flagged' || normalized === 'error') {
    return <span className="bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold uppercase">Flagged</span>;
  }
  return <span className="bg-[#00a651]/10 text-[#00a651] px-3 py-1 rounded-full text-xs font-bold uppercase">Success</span>;
}

const barData = [
  { height: '60%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: '$12k' },
  { height: '45%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '80%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '70%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '90%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '65%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '75%', opacity: 'bg-primary/30', hover: 'hover:bg-primary/50', tooltip: null },
  { height: '85%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '55%', opacity: 'bg-primary/20', hover: 'hover:bg-primary/40', tooltip: null },
  { height: '95%', opacity: 'bg-primary/40', hover: 'hover:bg-primary/60', tooltip: '$18.5k' },
];

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const res = await axios.get('/api/admin/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load overview.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const revenue = stats?.revenue ?? { value: 0, currency: 'USD' };

  return (
    <AdminPage title="Admin Overview" subtitle="Real-time infrastructure health and commercial performance.">
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

      {!loading && !error && stats && (
        <>
          <div className="admin-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 admin-section">
            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <span className="material-symbols-outlined">group</span>
                </div>
                <span className="text-xs font-bold text-[#00a651] bg-[#00a651]/10 px-2 py-1 rounded-full">+12.5%</span>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Users</span>
                <h3 className="text-[28px] font-bold text-on-surface">{stats.totalUsers.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                  <span className="material-symbols-outlined">dialer_sip</span>
                </div>
                <span className="text-xs font-bold text-[#00a651] bg-[#00a651]/10 px-2 py-1 rounded-full">+4.2%</span>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Active Numbers</span>
                <h3 className="text-[28px] font-bold text-on-surface">{stats.activeNumbers.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-tertiary-container/10 rounded-xl text-tertiary">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <span className="text-xs font-bold text-[#00a651] bg-[#00a651]/10 px-2 py-1 rounded-full">+18.3%</span>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Monthly Revenue</span>
                <h3 className="text-[28px] font-bold text-on-surface">{formatCurrency(revenue.value, revenue.currency)}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-error/10 rounded-xl text-error">
                  <span className="material-symbols-outlined">pending_actions</span>
                </div>
                <span className="text-xs font-bold text-error bg-error/10 px-2 py-1 rounded-full">High Priority</span>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Pending Approvals</span>
                <h3 className="text-[28px] font-bold text-on-surface">{stats.pendingApprovals}</h3>
              </div>
            </div>
          </div>

          <div className="admin-grid grid-cols-1 lg:grid-cols-3 admin-section">
            <div className="lg:col-span-2 admin-card-lg flex flex-col h-[280px]">
              <div className="flex justify-between items-center mb-md">
                <h4 className="font-headline-md text-headline-md text-on-surface">Revenue Growth</h4>
                <select className="bg-surface-container-low border-none rounded-lg text-label-md focus:ring-primary/20 outline-none">
                  <option>Last 30 Days</option>
                  <option>Last Quarter</option>
                  <option>Last Year</option>
                </select>
              </div>
              <div className="flex-1 relative w-full flex items-end justify-between gap-base px-4">
                {barData.map((bar, i) => (
                  <div
                    key={i}
                    className={`w-full rounded-t-lg relative group transition-all duration-300 ${bar.opacity} ${bar.hover}`}
                    style={{ height: bar.height }}
                  >
                    {bar.tooltip && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap">
                        {bar.tooltip}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-label-sm text-outline px-4">
                <span>Oct 01</span>
                <span>Oct 15</span>
                <span>Oct 31</span>
              </div>
            </div>

            <div className="admin-card-lg flex flex-col h-[280px]">
              <h4 className="font-headline-md text-headline-md text-on-surface mb-md">Quick Actions</h4>
              <div className="space-y-1 flex-1">
                <button
                  onClick={() => navigate('/admin/users')}
                  className="admin-action-btn hover:bg-primary hover:text-white transition-all duration-300 group"
                >
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">person_add</span>
                    <span className="font-body-md font-semibold">Add New User</span>
                  </div>
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>
                <button
                  onClick={() => navigate('/admin/payments')}
                  className="admin-action-btn hover:bg-primary hover:text-white transition-all duration-300 group"
                >
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">receipt_long</span>
                    <span className="font-body-md font-semibold">Review Payments</span>
                  </div>
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>
                <button className="admin-action-btn hover:bg-primary hover:text-white transition-all duration-300 group">
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">monitor_heart</span>
                    <span className="font-body-md font-semibold">System Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00a651] animate-pulse"></div>
                    <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/admin/numbers')}
                  className="admin-action-btn hover:bg-primary hover:text-white transition-all duration-300 group"
                >
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">phone_iphone</span>
                    <span className="font-body-md font-semibold">Manage Numbers</span>
                  </div>
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          <div className="admin-card-lg !p-0 overflow-hidden border border-white/20">
            <div className="px-md py-sm border-b border-outline-variant/10 flex justify-between items-center bg-white/30">
              <h4 className="font-headline-md text-headline-md text-on-surface">Administrative Activity</h4>
              <button className="text-primary font-semibold text-label-md hover:underline">View All Logs</button>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left">Admin User</th>
                    <th className="text-left">Action Taken</th>
                    <th className="text-left">Entity</th>
                    <th className="text-left">Timestamp</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {stats.recentActivity.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        No administrative activity recorded yet.
                      </td>
                    </tr>
                  )}
                  {stats.recentActivity.map((log) => (
                    <tr key={log.id} className="hover:bg-primary/5 transition-colors cursor-pointer group">
                      <td>
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {log.initials}
                          </div>
                          <span className="font-body-md font-medium text-on-surface">{log.admin}</span>
                        </div>
                      </td>
                      <td>{log.action}</td>
                      <td className="font-mono text-sm text-primary">{log.entity}</td>
                      <td>{timeAgo(log.timestamp)}</td>
                      <td className="text-right">
                        <StatusBadge status={log.status} />
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
