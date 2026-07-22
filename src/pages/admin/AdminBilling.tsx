import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface Transaction {
  id: string;
  reference: string;
  user: string | null;
  amount: number;
  tokens: number;
  currency: string;
  provider: string;
  type: string;
  status: string;
  createdAt: string;
}

interface BillingData {
  totalRevenue: number;
  monthlyRevenue: number;
  pending: number;
  failed: number;
  currency: string;
  transactions: Transaction[];
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

function TxStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'success' || s === 'completed') {
    return <span className="bg-[#00a651]/10 text-[#00a651] px-3 py-1 rounded-full text-xs font-bold uppercase">Success</span>;
  }
  if (s === 'failed') {
    return <span className="bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold uppercase">Failed</span>;
  }
  if (s === 'pending') {
    return <span className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-bold uppercase">Pending</span>;
  }
  return <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold uppercase">{status}</span>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminBilling() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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

        const res = await axios.get('/api/admin?action=billing', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load billing data.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredTx = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((t) => {
      const matchesSearch =
        !search ||
        t.reference.toLowerCase().includes(search.toLowerCase()) ||
        (t.user || '').toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && (t.status === 'success' || t.status === 'completed')) ||
        (statusFilter === 'pending' && t.status === 'pending') ||
        (statusFilter === 'failed' && t.status === 'failed');

      const matchesProvider =
        providerFilter === 'all' || t.provider.toLowerCase() === providerFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesProvider;
    });
  }, [data, search, statusFilter, providerFilter]);

  return (
    <AdminPage title="Billing & Payments" subtitle="Track revenue, transactions, and payment history.">
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
                <div className="p-3 bg-[#00a651]/10 rounded-xl text-[#00a651]">
                  <span className="material-symbols-outlined">payments</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Revenue</span>
                <h3 className="text-[28px] font-bold text-on-surface">{formatCurrency(data.totalRevenue, data.currency)}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <span className="material-symbols-outlined">trending_up</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Monthly Revenue</span>
                <h3 className="text-[28px] font-bold text-on-surface">{formatCurrency(data.monthlyRevenue, data.currency)}</h3>
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
                <h3 className="text-[28px] font-bold text-on-surface">{data.pending.toLocaleString()}</h3>
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
              <h4 className="font-headline-md text-headline-md text-on-surface">All Transactions</h4>
              <div className="flex items-center gap-sm w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:flex-none">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search reference or user..."
                    className="w-full sm:w-48 bg-surface-container-low border-none rounded-lg py-1.5 pl-9 pr-3 text-label-md focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg text-label-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg text-label-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">All Providers</option>
                  <option value="korapay">Korapay</option>
                  <option value="balance">Balance</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left">Reference</th>
                    <th className="text-left">User</th>
                    <th className="text-left">Amount</th>
                    <th className="text-left">Provider</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Date</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredTx.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center !py-md">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                  {filteredTx.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTx(t)}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                    >
                      <td className="font-mono text-xs text-primary">{t.reference}</td>
                      <td className="font-body-md text-on-surface-variant text-sm">{t.user || '—'}</td>
                      <td className="font-body-md font-medium text-on-surface">
                        {t.currency === 'COINS' ? `${t.tokens} coins` : formatCurrency(t.amount / 100, t.currency)}
                      </td>
                      <td className="text-on-surface-variant text-sm capitalize">{t.provider || '—'}</td>
                      <td className="text-on-surface-variant text-sm capitalize">{t.type}</td>
                      <td className="text-on-surface-variant text-sm">{formatDateTime(t.createdAt)}</td>
                      <td className="text-right"><TxStatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedTx && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedTx(null)}
            >
              <div
                className="admin-card-lg max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-md">
                  <h4 className="font-headline-md text-headline-md text-on-surface">Transaction Details</h4>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors"
                  >
                    close
                  </button>
                </div>
                <div className="space-y-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Reference</span>
                    <span className="font-mono text-xs text-primary">{selectedTx.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">User</span>
                    <span className="font-body-md text-on-surface">{selectedTx.user || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Amount</span>
                    <span className="font-body-md font-medium text-on-surface">
                      {selectedTx.currency === 'COINS' ? `${selectedTx.tokens} coins` : formatCurrency(selectedTx.amount / 100, selectedTx.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Provider</span>
                    <span className="font-body-md text-on-surface capitalize">{selectedTx.provider || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Type</span>
                    <span className="font-body-md text-on-surface capitalize">{selectedTx.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Status</span>
                    <TxStatusBadge status={selectedTx.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Date</span>
                    <span className="font-body-md text-on-surface">{formatDateTime(selectedTx.createdAt)}</span>
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
