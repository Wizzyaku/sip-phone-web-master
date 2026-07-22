import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phoneNumber: string | null;
  role: string;
  createdAt: string;
  tokenBalance: number;
  assignedNumbers: number;
}

interface UsersData {
  total: number;
  active: number;
  admins: number;
  suspended: number;
  users: User[];
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase">Admin</span>;
  }
  return <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold uppercase">User</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminUsers() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

        const res = await axios.get('/api/admin?action=users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to load users.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.users.filter((u) => {
      const matchesSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.phoneNumber || '').includes(search);

      const matchesRole = roleFilter === 'all' || (roleFilter === 'admin' && u.role === 'admin') || (roleFilter === 'user' && u.role !== 'admin');

      return matchesSearch && matchesRole;
    });
  }, [data, search, roleFilter]);

  return (
    <AdminPage title="Users" subtitle="Manage all users, roles, and account status.">
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
                  <span className="material-symbols-outlined">group</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Total Users</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.total.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-[#00a651]/10 rounded-xl text-[#00a651]">
                  <span className="material-symbols-outlined">active_account</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Active (30d)</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.active.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                  <span className="material-symbols-outlined">shield_person</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Admins</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.admins.toLocaleString()}</h3>
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
              <div className="flex justify-between items-start mb-sm">
                <div className="p-3 bg-error/10 rounded-xl text-error">
                  <span className="material-symbols-outlined">block</span>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant text-label-md block mb-1">Suspended</span>
                <h3 className="text-[28px] font-bold text-on-surface">{data.suspended.toLocaleString()}</h3>
              </div>
            </div>
          </div>

          <div className="admin-card-lg !p-0 overflow-hidden border border-white/20">
            <div className="px-md py-sm border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-sm bg-white/30">
              <h4 className="font-headline-md text-headline-md text-on-surface">All Users</h4>
              <div className="flex items-center gap-sm w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, phone..."
                    className="w-full sm:w-56 bg-surface-container-low border-none rounded-lg py-1.5 pl-9 pr-3 text-label-md focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded-lg text-label-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="text-left">User</th>
                    <th className="text-left">Email</th>
                    <th className="text-left">Role</th>
                    <th className="text-left">Phone</th>
                    <th className="text-left">Joined</th>
                    <th className="text-right">Numbers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center !py-md">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                    >
                      <td>
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs overflow-hidden">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                            )}
                          </div>
                          <span className="font-body-md font-medium text-on-surface">{u.name}</span>
                        </div>
                      </td>
                      <td className="text-on-surface-variant text-sm">{u.email}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td className="text-on-surface-variant text-sm">{u.phoneNumber || '—'}</td>
                      <td className="text-on-surface-variant text-sm">{formatDate(u.createdAt)}</td>
                      <td className="text-right font-body-md font-medium text-on-surface">{u.assignedNumbers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedUser && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedUser(null)}
            >
              <div
                className="admin-card-lg max-w-md w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-md">
                  <h4 className="font-headline-md text-headline-md text-on-surface">User Details</h4>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors"
                  >
                    close
                  </button>
                </div>
                <div className="flex items-center gap-md mb-md">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl overflow-hidden">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      selectedUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">{selectedUser.name}</h3>
                    <p className="text-on-surface-variant text-sm">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="space-y-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Role</span>
                    <RoleBadge role={selectedUser.role} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Phone</span>
                    <span className="font-body-md text-on-surface">{selectedUser.phoneNumber || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Token Balance</span>
                    <span className="font-body-md font-medium text-on-surface">{selectedUser.tokenBalance.toLocaleString()} coins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Assigned Numbers</span>
                    <span className="font-body-md font-medium text-on-surface">{selectedUser.assignedNumbers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant text-label-md">Joined</span>
                    <span className="font-body-md text-on-surface">{formatDate(selectedUser.createdAt)}</span>
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
