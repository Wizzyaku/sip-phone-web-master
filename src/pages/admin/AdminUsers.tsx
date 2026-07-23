import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../../components/AdminPage';

interface AvailableNumber {
  id: string;
  number: string;
  label: string;
  flag: string;
  features: string[];
  active: boolean;
  monthlyCost: number;
  currentOwner: string | null;
}

interface UserNumber {
  id: string;
  number: string;
  label: string;
  active: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phoneNumber: string | null;
  role: string;
  createdAt: string | null;
  tokenBalance: number;
  assignedNumbers: number;
  numbers: UserNumber[];
  telegram: string | null;
  telegramChatId: string | null;
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminUsers() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [numbersExpanded, setNumbersExpanded] = useState(false);
  const [editBalance, setEditBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceMsg, setBalanceMsg] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [numberSearch, setNumberSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [editTelegram, setEditTelegram] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

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

  const openDrawer = (user: User) => {
    setSelectedUser(user);
    setNumbersExpanded(false);
    setEditBalance(false);
    setBalanceMsg(null);
    setShowAssignModal(false);
    setAssignMsg(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setShowAssignModal(false);
    setTimeout(() => setSelectedUser(null), 300);
  };

  const loadAvailableNumbers = async () => {
    setLoadingNumbers(true);
    setAssignMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await axios.get('/api/admin?action=available-numbers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableNumbers(res.data.available || []);
    } catch {
      setAssignMsg('Failed to load available numbers.');
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleAssignNumber = async (numberId: string, number: string) => {
    if (!selectedUser) return;
    setAssigningId(numberId);
    setAssignMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setAssignMsg('No active session.');
        setAssigningId(null);
        return;
      }

      const assignRes = await axios.post(
        '/api/admin?action=assign-number',
        { numberId, phoneNumber: number, userId: selectedUser.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assignedId = assignRes.data?.numberId || numberId;
      const newNumber: UserNumber = {
        id: assignedId,
        number,
        label: availableNumbers.find((n) => n.id === numberId)?.label || '',
        active: true,
      };

      setSelectedUser((prev) => prev ? {
        ...prev,
        numbers: [...prev.numbers, newNumber],
        assignedNumbers: prev.assignedNumbers + 1,
      } : prev);

      setAvailableNumbers((prev) => prev.filter((n) => n.id !== numberId));
      setAssignMsg(`Number ${number} assigned successfully.`);
      setNumbersExpanded(true);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to assign number.';
      setAssignMsg(message);
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassignNumber = async (numberId: string, phoneNumber: string) => {
    if (!selectedUser) return;
    setUnassigningId(numberId);
    setAssignMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setAssignMsg('No active session.');
        setUnassigningId(null);
        return;
      }

      await axios.post(
        '/api/admin?action=unassign-number',
        { numberId, phoneNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSelectedUser((prev) => prev ? {
        ...prev,
        numbers: prev.numbers.filter((n) => n.id !== numberId),
        assignedNumbers: prev.assignedNumbers - 1,
      } : prev);

      setAssignMsg('Number unassigned successfully.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to unassign number.';
      setAssignMsg(message);
    } finally {
      setUnassigningId(null);
    }
  };

  const handleSaveBalance = async () => {
    if (!selectedUser) return;
    const newBalance = parseInt(balanceInput, 10);
    if (isNaN(newBalance) || newBalance < 0) {
      setBalanceMsg('Please enter a valid number.');
      return;
    }

    setBalanceSaving(true);
    setBalanceMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setBalanceMsg('No active session.');
        setBalanceSaving(false);
        return;
      }

      await axios.post(
        '/api/admin?action=update-balance',
        { userId: selectedUser.id, tokens: newBalance },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setData((prev) => prev ? {
        ...prev,
        users: prev.users.map((u) =>
          u.id === selectedUser.id ? { ...u, tokenBalance: newBalance } : u
        ),
      } : prev);
      setSelectedUser((prev) => prev ? { ...prev, tokenBalance: newBalance } : prev);
      setEditBalance(false);
      setBalanceMsg('Balance updated successfully.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to update balance.';
      setBalanceMsg(message);
    } finally {
      setBalanceSaving(false);
    }
  };

  const handleSaveTelegram = async () => {
    if (!selectedUser) return;
    const trimmed = telegramInput.trim();
    if (!trimmed) {
      setTelegramMsg('Please enter a Telegram Chat ID.');
      return;
    }

    setTelegramSaving(true);
    setTelegramMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setTelegramMsg('No active session.');
        setTelegramSaving(false);
        return;
      }

      await axios.post(
        '/api/admin?action=update-telegram',
        { userId: selectedUser.id, chatId: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setData((prev) => prev ? {
        ...prev,
        users: prev.users.map((u) =>
          u.id === selectedUser.id ? { ...u, telegramChatId: trimmed } : u
        ),
      } : prev);
      setSelectedUser((prev) => prev ? { ...prev, telegramChatId: trimmed } : prev);
      setEditTelegram(false);
      setTelegramMsg('Telegram linked successfully.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to link Telegram.';
      setTelegramMsg(message);
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!selectedUser) return;
    setTelegramSaving(true);
    setTelegramMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setTelegramMsg('No active session.');
        setTelegramSaving(false);
        return;
      }

      await axios.post(
        '/api/admin?action=update-telegram',
        { userId: selectedUser.id, chatId: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setData((prev) => prev ? {
        ...prev,
        users: prev.users.map((u) =>
          u.id === selectedUser.id ? { ...u, telegramChatId: null } : u
        ),
      } : prev);
      setSelectedUser((prev) => prev ? { ...prev, telegramChatId: null } : prev);
      setTelegramMsg('Telegram unlinked successfully.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to unlink Telegram.';
      setTelegramMsg(message);
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!selectedUser) return;
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailMsg('Please enter an email address.');
      return;
    }

    setEmailSaving(true);
    setEmailMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setEmailMsg('No active session.');
        setEmailSaving(false);
        return;
      }

      const res = await axios.post(
        '/api/admin?action=update-email',
        { userId: selectedUser.id, email: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newEmail = res.data.email || trimmed;
      setData((prev) => prev ? {
        ...prev,
        users: prev.users.map((u) =>
          u.id === selectedUser.id ? { ...u, email: newEmail } : u
        ),
      } : prev);
      setSelectedUser((prev) => prev ? { ...prev, email: newEmail } : prev);
      setEditEmail(false);
      setEmailMsg('Email updated successfully.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to update email.';
      setEmailMsg(message);
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!selectedUser) return;
    if (passwordInput.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }

    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setPasswordMsg('No active session.');
        setPasswordSaving(false);
        return;
      }

      await axios.post(
        '/api/admin?action=update-password',
        { userId: selectedUser.id, password: passwordInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditPassword(false);
      setPasswordInput('');
      setPasswordMsg('Password updated successfully.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Failed to update password.';
      setPasswordMsg(message);
    } finally {
      setPasswordSaving(false);
    }
  };

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
                  <span className="material-symbols-outlined">person_check</span>
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
                    placeholder="Search name or email..."
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
                    <th className="text-left">Joined</th>
                    <th className="text-right">Numbers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center !py-md">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => openDrawer(u)}
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
                      <td className="text-on-surface-variant text-sm">{formatDate(u.createdAt)}</td>
                      <td className="text-right font-body-md font-medium text-on-surface">{u.assignedNumbers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Backdrop */}
          {selectedUser && (
            <div
              className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                drawerOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={closeDrawer}
            />
          )}

          {/* Slide-out drawer */}
          {selectedUser && (
            <div
              className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface z-50 shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${
                drawerOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Header */}
              <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-outline-variant/10 px-4 py-3 z-10">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-lg font-semibold text-on-surface">User Details</h4>
                  <button
                    onClick={closeDrawer}
                    className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors text-xl"
                  >
                    close
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      selectedUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-on-surface truncate">{selectedUser.name}</h3>
                    <p className="text-on-surface-variant text-xs truncate">{selectedUser.email}</p>
                    <div className="mt-0.5"><RoleBadge role={selectedUser.role} /></div>
                  </div>
                </div>
              </div>

              {/* Body sections */}
              <div className="px-4 py-3 space-y-3">
                {/* Account Section: Profile + Password combined */}
                <div className="admin-card !p-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-base">person</span>
                    <h5 className="text-sm font-semibold text-on-surface">Account</h5>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant text-xs">Name</span>
                      <span className="text-on-surface">{selectedUser.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant text-xs">Email</span>
                      {!editEmail ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-on-surface text-xs break-all">{selectedUser.email || '—'}</span>
                          <button
                            onClick={() => {
                              setEditEmail(true);
                              setEmailInput(selectedUser.email || '');
                              setEmailMsg(null);
                            }}
                            className="admin-action-btn !px-1.5 !py-0.5 text-xs"
                          >
                            <span className="material-symbols-outlined text-xs">edit</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="bg-surface-container-low border-none rounded-md py-1 px-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none w-40"
                            placeholder="new@email.com"
                          />
                          <button
                            onClick={handleSaveEmail}
                            disabled={emailSaving}
                            className="admin-action-btn !px-2 !py-1 text-xs"
                          >
                            {emailSaving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditEmail(false); setEmailMsg(null); }}
                            className="admin-action-btn !px-2 !py-1 text-xs !text-error"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {emailMsg && (
                      <p className={`text-xs ${emailMsg.includes('success') ? 'text-[#00a651]' : 'text-error'}`}>{emailMsg}</p>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant text-xs">Password</span>
                      {!editPassword ? (
                        <button
                          onClick={() => {
                            setEditPassword(true);
                            setPasswordInput('');
                            setPasswordMsg(null);
                          }}
                          className="admin-action-btn !px-2 !py-1 text-xs"
                        >
                          Change
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="bg-surface-container-low border-none rounded-md py-1 px-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none w-32"
                            placeholder="Min 6 chars"
                          />
                          <button
                            onClick={handleSavePassword}
                            disabled={passwordSaving}
                            className="admin-action-btn !px-2 !py-1 text-xs"
                          >
                            {passwordSaving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditPassword(false); setPasswordInput(''); setPasswordMsg(null); }}
                            className="admin-action-btn !px-2 !py-1 text-xs !text-error"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {passwordMsg && (
                      <p className={`text-xs ${passwordMsg.includes('success') ? 'text-[#00a651]' : 'text-error'}`}>{passwordMsg}</p>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant text-xs">Joined</span>
                      <span className="text-on-surface text-xs">{formatDate(selectedUser.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Phone Numbers Dropdown Section */}
                <div className="admin-card !p-sm">
                  <button
                    onClick={() => setNumbersExpanded(!numbersExpanded)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">phone_iphone</span>
                      <h5 className="text-sm font-semibold text-on-surface">
                        Phone Numbers ({selectedUser.numbers.length})
                      </h5>
                    </div>
                    <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 text-lg ${numbersExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                  {numbersExpanded && (
                    <div className="mt-2 space-y-1.5">
                      {selectedUser.numbers.length === 0 ? (
                        <p className="text-on-surface-variant text-xs italic">No phone numbers assigned.</p>
                      ) : (
                        selectedUser.numbers.map((n) => (
                          <div key={n.id} className="flex items-center justify-between bg-surface-container-low rounded-md px-2 py-1.5">
                            <div>
                              <span className="text-sm font-medium text-on-surface">{n.number}</span>
                              {n.label && <span className="text-on-surface-variant text-xs ml-2">{n.label}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold uppercase ${n.active ? 'text-[#00a651]' : 'text-on-surface-variant'}`}>
                                {n.active ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnassignNumber(n.id, n.number); }}
                                disabled={unassigningId === n.id}
                                className="text-error text-xs hover:underline disabled:opacity-50"
                              >
                                {unassigningId === n.id ? '...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                      <button
                        onClick={() => {
                          setShowAssignModal(true);
                          loadAvailableNumbers();
                        }}
                        className="admin-action-btn w-full !py-1.5 text-xs flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        Assign Number
                      </button>
                    </div>
                  )}
                </div>

                {/* Telegram + Balance combined */}
                <div className="admin-card !p-sm">
                  <div className="space-y-2">
                    {/* Telegram row */}
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">send</span>
                          <h5 className="text-sm font-semibold text-on-surface">Telegram</h5>
                        </div>
                        {!editTelegram && (
                          <div className="flex items-center gap-1.5">
                            {selectedUser.telegramChatId ? (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00a651]" />
                                <span className="text-xs text-on-surface">{selectedUser.telegramChatId}</span>
                                <button
                                  onClick={handleUnlinkTelegram}
                                  disabled={telegramSaving}
                                  className="text-error text-xs hover:underline disabled:opacity-50"
                                >
                                  {telegramSaving ? '...' : 'Unlink'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditTelegram(true);
                                    setTelegramInput(selectedUser.telegramChatId || '');
                                    setTelegramMsg(null);
                                  }}
                                  className="admin-action-btn !px-1.5 !py-0.5 text-xs"
                                >
                                  <span className="material-symbols-outlined text-xs">edit</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-error" />
                                <span className="text-xs text-on-surface-variant">Not linked</span>
                                <button
                                  onClick={() => {
                                    setEditTelegram(true);
                                    setTelegramInput('');
                                    setTelegramMsg(null);
                                  }}
                                  className="admin-action-btn !px-2 !py-0.5 text-xs"
                                >
                                  Link
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {editTelegram && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={telegramInput}
                            onChange={(e) => setTelegramInput(e.target.value)}
                            className="flex-1 bg-surface-container-low border-none rounded-md py-1 px-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Telegram Chat ID (e.g. 123456789)"
                          />
                          <button
                            onClick={handleSaveTelegram}
                            disabled={telegramSaving}
                            className="admin-action-btn !px-2 !py-1 text-xs"
                          >
                            {telegramSaving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditTelegram(false); setTelegramMsg(null); }}
                            className="admin-action-btn !px-2 !py-1 text-xs !text-error"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {telegramMsg && (
                        <p className={`text-xs mt-1 ${telegramMsg.includes('success') ? 'text-[#00a651]' : 'text-error'}`}>{telegramMsg}</p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-outline/10" />

                    {/* Balance row */}
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">account_balance_wallet</span>
                          <h5 className="text-sm font-semibold text-on-surface">Token Balance</h5>
                        </div>
                        {!editBalance && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-on-surface">{selectedUser.tokenBalance.toLocaleString()}</span>
                            <span className="text-xs text-on-surface-variant">coins</span>
                            <button
                              onClick={() => {
                                setEditBalance(true);
                                setBalanceInput(String(selectedUser.tokenBalance));
                                setBalanceMsg(null);
                              }}
                              className="admin-action-btn !px-1.5 !py-0.5 text-xs"
                            >
                              <span className="material-symbols-outlined text-xs">edit</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {editBalance && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <input
                            type="number"
                            value={balanceInput}
                            onChange={(e) => setBalanceInput(e.target.value)}
                            className="flex-1 bg-surface-container-low border-none rounded-md py-1 px-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Enter new balance"
                          />
                          <button
                            onClick={handleSaveBalance}
                            disabled={balanceSaving}
                            className="admin-action-btn !px-2 !py-1 text-xs"
                          >
                            {balanceSaving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditBalance(false); setBalanceMsg(null); }}
                            className="admin-action-btn !px-2 !py-1 text-xs !text-error"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {balanceMsg && (
                        <p className={`text-xs mt-1 ${balanceMsg.includes('success') ? 'text-[#00a651]' : 'text-error'}`}>{balanceMsg}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assign Number Modal */}
              {showAssignModal && (
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setShowAssignModal(false)}
                >
                  <div
                    className="bg-surface rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden border border-outline/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-center px-5 py-4 border-b border-outline/15">
                      <div>
                        <h5 className="text-lg font-semibold text-on-surface">Assign Number</h5>
                        <p className="text-on-surface-variant text-xs mt-0.5">
                          Assigning to <span className="font-semibold text-on-surface">{selectedUser.name}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAssignModal(false)}
                        className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors text-xl"
                      >
                        close
                      </button>
                    </div>

                    {/* Search */}
                    <div className="px-5 py-3 border-b border-outline/10">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                          search
                        </span>
                        <input
                          type="text"
                          value={numberSearch}
                          onChange={(e) => setNumberSearch(e.target.value)}
                          placeholder="Search numbers..."
                          className="w-full bg-surface-container-low border border-outline/15 rounded-xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all"
                        />
                      </div>
                      {assignMsg && (
                        <p className={`text-xs mt-2 ${assignMsg.includes('success') ? 'text-[#00a651]' : 'text-error'}`}>{assignMsg}</p>
                      )}
                    </div>

                    {/* Number list */}
                    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                      {loadingNumbers && (
                        <div className="text-center py-8">
                          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {!loadingNumbers && availableNumbers.length === 0 && (
                        <p className="text-on-surface-variant text-sm italic text-center py-8">
                          No numbers found on the platform.
                        </p>
                      )}
                      {!loadingNumbers && availableNumbers
                        .filter((n) =>
                          !numberSearch ||
                          n.number.replace(/\D/g, '').includes(numberSearch.replace(/\D/g, '')) ||
                          (n.label || '').toLowerCase().includes(numberSearch.toLowerCase())
                        )
                        .map((n) => (
                          <div
                            key={n.id}
                            className="flex items-center justify-between bg-surface-container-low hover:bg-surface-container transition-colors rounded-xl px-4 py-3 border border-outline/10"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-on-surface block">{n.number || '(no number)'}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {n.label && (
                                  <span className="text-on-surface-variant text-xs capitalize">{n.label}</span>
                                )}
                                {n.currentOwner && (
                                  <span className="text-xs text-amber-600 font-medium">Owned by {n.currentOwner}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAssignNumber(n.id, n.number)}
                              disabled={assigningId === n.id}
                              className={`shrink-0 ml-3 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                                n.currentOwner
                                  ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30'
                                  : 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm'
                              }`}
                            >
                              {assigningId === n.id ? '...' : n.currentOwner ? 'Reassign' : 'Assign'}
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}
