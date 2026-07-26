import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Palette,
  Bell,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  Pencil,
  Copy,
  CheckCircle,
  Loader2,
  LogOut,
  Laptop,
  Smartphone,
  RotateCcw,
  Check,
  Phone,
  ChevronRight,
  Mail,
  MessageCircle,
  HelpCircle,
  FileText,
  Unlink,
} from 'lucide-react';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { saveProfile } from '../lib/profile';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { TelegramLoginWidget, type TelegramAuthUser } from '../components/TelegramLoginWidget';

const themes = [
  { id: 'light', label: 'Light Theme', icon: Sun },
  { id: 'dark', label: 'Dark Theme', icon: Moon },
  { id: 'system', label: 'System Theme', icon: Monitor },
] as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const currentSession = {
  id: 'current',
  device: typeof navigator !== 'undefined' && /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'Mobile Device' : 'Desktop Browser',
  icon: typeof navigator !== 'undefined' && /Mobile|Android|iPhone/.test(navigator.userAgent) ? Smartphone : Laptop,
  location: 'Current Session',
  current: true,
};

export function Settings() {
  const navigate = useNavigate();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const notifications = useAppStore((s) => s.notifications);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const telnyxNumber = useAppStore((s) => s.telnyxNumber);

  const [editingProfile, setEditingProfile] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState({ name: user.name, email: user.email, bio: user.bio ?? '', avatar: user.avatar });
  const [copied, setCopied] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [telegram, setTelegram] = useState({
    linked: false,
    enabled: false,
    chatId: '',
    botUsername: '',
    linkUrl: '',
    loading: true,
    generating: false,
    unlinking: false,
    linking: false,
    error: '',
  });
  const [signOutModal, setSignOutModal] = useState(false);
  const [helpCenterModal, setHelpCenterModal] = useState(false);
  const [termsPrivacyModal, setTermsPrivacyModal] = useState(false);
  const [clearNotifModal, setClearNotifModal] = useState(false);
  const isDesktop = useIsDesktop();

  const accountNumber = user.email ? `#${user.email.split('@')[0].toUpperCase().slice(0, 8)}` : '#USER';

  const handleSave = async () => {
    const updatedUser = { ...user, ...draft, avatar: getInitials(draft.name) };
    setUser(updatedUser);
    await saveProfile(updatedUser, telnyxNumber);
    setSaved(true);
    setEditingProfile(false);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const API_URL = import.meta.env.VITE_API_URL ?? '/api';

  const getUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  };

  const fetchTelegramStatus = async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        setTelegram((t) => ({ ...t, loading: false }));
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_chat_id, telegram_enabled')
        .eq('id', userId)
        .maybeSingle();

      // Fetch bot username for the login widget
      try {
        const botRes = await axios.get(`${API_URL}/telegram-webhook?action=bot-info`);
        setTelegram((t) => ({ ...t, botUsername: botRes.data.username || '' }));
      } catch {
        console.warn('Failed to fetch Telegram bot username');
      }

      setTelegram((t) => ({
        ...t,
        linked: !!profile?.telegram_chat_id,
        enabled: !!profile?.telegram_enabled,
        chatId: profile?.telegram_chat_id ?? '',
        loading: false,
      }));
    } catch {
      setTelegram((t) => ({ ...t, loading: false }));
    }
  };

  const handleToggleTelegram = async () => {
    const next = !telegram.enabled;
    setTelegram((t) => ({ ...t, enabled: next }));
    try {
      const userId = await getUserId();
      if (!userId) return;
      await supabase.from('profiles').update({ telegram_enabled: next }).eq('id', userId);
    } catch (err) {
      console.error('Failed to toggle Telegram:', err);
      setTelegram((t) => ({ ...t, enabled: !next }));
    }
  };

  const handleUnlinkTelegram = async () => {
    try {
      setTelegram((t) => ({ ...t, unlinking: true }));
      const userId = await getUserId();
      if (!userId) return;
      await supabase
        .from('profiles')
        .update({ telegram_chat_id: null, telegram_enabled: false, telegram_code: null, telegram_code_expires_at: null })
        .eq('id', userId);
      setTelegram((t) => ({ ...t, linked: false, enabled: false, chatId: '', unlinking: false }));
    } catch (err) {
      console.error('Failed to unlink Telegram:', err);
      setTelegram((t) => ({ ...t, unlinking: false }));
    }
  };

  const handleTelegramAuth = async (user: TelegramAuthUser) => {
    try {
      setTelegram((t) => ({ ...t, linking: true, error: '' }));
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        setTelegram((t) => ({ ...t, linking: false, error: 'Not authenticated.' }));
        return;
      }
      const res = await axios.post(`${API_URL}/telegram-webhook?action=link-widget`, user, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setTelegram((t) => ({
          ...t,
          linked: true,
          enabled: true,
          chatId: res.data.chatId,
          linking: false,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link Telegram';
      setTelegram((t) => ({ ...t, linking: false, error: msg }));
    }
  };

  useEffect(() => {
    fetchTelegramStatus();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="relative w-full min-w-0 bg-background md:rounded-2xl md:border md:border-border/30">
      {/* ========================================== */}
      {/* MOBILE VIEW                                 */}
      {/* ========================================== */}
      {!isDesktop && (
        <div className="flex flex-col bg-[#F0F4F8] dark:bg-slate-950">
          {/* Mobile Header */}
          <header className="shrink-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 pt-4 pb-3 px-4 flex items-center justify-between z-20 dark:bg-slate-900/90 dark:border-slate-700/50">
            <h1 className="text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Settings</h1>
            <button className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition-transform shadow-sm dark:bg-slate-800 dark:border-slate-700">
              <HelpCircle className="w-4 h-4" />
            </button>
          </header>

          {/* Scrollable Content */}
          <div className="overflow-y-auto no-scrollbar px-4 pt-3 pb-[10px] flex flex-col gap-4 z-10">
            {/* 1. Profile Summary Card */}
            <div className="animate-fade-in shrink-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-4 flex items-center gap-4 dark:bg-slate-900 dark:border-slate-700/50">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-indigo-50 flex items-center justify-center dark:bg-indigo-900/30 dark:border-slate-700">
                  {user.avatar && user.avatar.startsWith('http') ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[20px] font-extrabold text-indigo-600 dark:text-indigo-400">{getInitials(user.name)}</span>
                  )}
                </div>
                <button
                  onClick={() => setEditingProfile((v) => !v)}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-indigo-600 text-white rounded-full border-2 border-white flex items-center justify-center shadow-sm active:scale-95 transition-transform dark:border-slate-900"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-col flex-grow min-w-0">
                <h2 className="text-[18px] font-extrabold text-slate-800 leading-tight truncate dark:text-slate-100">{user.name}</h2>
                <p className="text-[12px] font-medium text-slate-500 truncate dark:text-slate-400">{user.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400">Personal</span>
                  <span className="text-[10px] font-bold text-slate-400 border-l border-slate-200 pl-1.5 dark:border-slate-700">ID: {accountNumber}</span>
                </div>
              </div>
            </div>

            {/* Profile Edit Section */}
            {editingProfile && (
              <div className="animate-fade-in shrink-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-4 flex flex-col gap-3 dark:bg-slate-900 dark:border-slate-700/50">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Full Name</label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[12px] px-3 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <input
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[12px] px-3 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Professional Bio</label>
                  <input
                    value={draft.bio}
                    onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                    placeholder="Tell us about your role"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[12px] px-3 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  />
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => { setEditingProfile(false); setDraft({ ...draft, name: user.name, email: user.email, bio: user.bio ?? '' }); }}
                    className="flex-1 h-10 bg-slate-50 border border-slate-200 rounded-[12px] text-[13px] font-bold text-slate-600 active:scale-95 transition-transform dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 h-10 bg-indigo-600 text-white rounded-[12px] text-[13px] font-bold active:scale-95 transition-transform"
                  >
                    {saved ? <Check className="w-4 h-4 mx-auto" /> : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Account Settings */}
            <div className="animate-fade-in animate-delay-100 shrink-0 flex flex-col gap-2">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2">Account</h3>
              <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col divide-y divide-slate-100 p-1.5 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/50">
                {/* Personal Information */}
                <button
                  onClick={() => setEditingProfile(true)}
                  className="p-2 flex items-center justify-between group active:bg-slate-50 rounded-[14px] transition-colors text-left dark:active:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 dark:bg-slate-800 dark:text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Personal Information</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>

                {/* Two-Factor Auth */}
                <div className="p-2 flex items-center justify-between group active:bg-slate-50 rounded-[14px] transition-colors cursor-pointer dark:active:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-slate-50 flex items-center justify-center text-slate-500 shrink-0 dark:bg-slate-800 dark:text-slate-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Two-Factor Auth</span>
                      <span className="text-[9px] font-bold text-slate-400">Not Enabled</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            </div>

            {/* 3. Preferences */}
            <div className="animate-fade-in animate-delay-200 shrink-0 flex flex-col gap-2">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2">Preferences</h3>
              <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col divide-y divide-slate-100 p-1.5 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/50">
                {/* Push Notifications Toggle */}
                <div className="p-2 flex items-center justify-between group rounded-[14px] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 dark:bg-amber-900/20 dark:text-amber-400">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Push Notifications</span>
                      <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">Calls & Messages alerts</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setPushNotifications(!pushNotifications)}
                    className={cn(
                      'relative inline-block w-10 mr-1 align-middle select-none transition duration-200 ease-in h-6 rounded-full cursor-pointer',
                      pushNotifications ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white border-4 transition-all duration-300 shadow-sm',
                        pushNotifications ? 'translate-x-4 border-indigo-600' : 'border-slate-200 dark:border-slate-700'
                      )}
                    />
                  </button>
                </div>

                {/* Email Alerts Toggle */}
                <div className="p-2 flex items-center justify-between group rounded-[14px] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-sky-50 flex items-center justify-center text-sky-500 shrink-0 dark:bg-sky-900/20 dark:text-sky-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Email Alerts</span>
                      <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">Billing & Usage reports</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setEmailAlerts(!emailAlerts)}
                    className={cn(
                      'relative inline-block w-10 mr-1 align-middle select-none transition duration-200 ease-in h-6 rounded-full cursor-pointer',
                      emailAlerts ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white border-4 transition-all duration-300 shadow-sm',
                        emailAlerts ? 'translate-x-4 border-indigo-600' : 'border-slate-200 dark:border-slate-700'
                      )}
                    />
                  </button>
                </div>

                {/* Appearance */}
                <div className="p-2 flex items-center justify-between group active:bg-slate-50 rounded-[14px] transition-colors cursor-pointer dark:active:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 dark:bg-purple-900/20 dark:text-purple-400">
                      <Palette className="w-4 h-4" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Appearance</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-400 capitalize dark:text-slate-500">{theme}</span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* Telegram */}
            <div className="animate-fade-in animate-delay-200 shrink-0 flex flex-col gap-2">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2">Telegram</h3>
              <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col gap-3 p-4 dark:bg-slate-900 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-sky-50 flex items-center justify-center text-sky-500 dark:bg-sky-900/20 dark:text-sky-400">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col flex-grow">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Telegram</span>
                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                      {telegram.loading ? 'Loading...' : telegram.linked ? (telegram.enabled ? 'Linked & Active' : 'Linked — Off') : 'Not linked'}
                    </span>
                  </div>
                </div>
                {telegram.loading ? null : telegram.linked ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Notifications</span>
                      <button
                        onClick={handleToggleTelegram}
                        className={cn(
                          'relative inline-block w-10 mr-1 align-middle select-none transition duration-200 ease-in h-6 rounded-full cursor-pointer',
                          telegram.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white border-4 transition-all duration-300 shadow-sm',
                            telegram.enabled ? 'translate-x-4 border-indigo-600' : 'border-slate-200 dark:border-slate-700'
                          )}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400">Chat ID</span>
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">{telegram.chatId}</span>
                      </div>
                      <button
                        onClick={handleUnlinkTelegram}
                        disabled={telegram.unlinking}
                        className="flex items-center gap-1.5 h-8 px-3 bg-red-50 text-red-600 rounded-[8px] text-[11px] font-bold active:scale-95 transition-transform disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                      >
                        {telegram.unlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                        Unlink
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-1">
                    {telegram.linking && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Linking...
                      </div>
                    )}
                    {telegram.error && (
                      <span className="text-[10px] text-red-500 text-center">{telegram.error}</span>
                    )}
                    {telegram.botUsername && !telegram.linking && (
                      <TelegramLoginWidget
                        botUsername={telegram.botUsername}
                        onAuth={handleTelegramAuth}
                        size="small"
                      />
                    )}
                    {!telegram.botUsername && !telegram.linking && (
                      <span className="text-[10px] text-slate-400 text-center">Bot not configured. Set TELEGRAM_BOT_TOKEN.</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Theme Selector (inline) */}
            <div className="animate-fade-in animate-delay-200 shrink-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 flex flex-col gap-2.5 dark:bg-slate-900 dark:border-slate-700/50">
              <h4 className="text-[12px] font-bold text-slate-700 dark:text-slate-200">Theme</h4>
              <div className="grid grid-cols-3 gap-2">
                {themes.map((t) => {
                  const Icon = t.icon;
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as typeof theme)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-[12px] border-2 py-3 transition-all',
                        active
                          ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 dark:border-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-bold">{t.label.replace(' Theme', '')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Support & Legal */}
            <div className="animate-fade-in animate-delay-300 shrink-0 flex flex-col gap-2 mt-1">
              <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col divide-y divide-slate-100 p-1.5 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/50">
                <button
                  onClick={() => setHelpCenterModal(true)}
                  className="p-2 flex items-center justify-between group active:bg-slate-50 rounded-[14px] transition-colors text-left w-full dark:active:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 dark:bg-slate-800 dark:text-slate-400">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Help Center</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>
                <button
                  onClick={() => setTermsPrivacyModal(true)}
                  className="p-2 flex items-center justify-between group active:bg-slate-50 rounded-[14px] transition-colors text-left w-full dark:active:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 dark:bg-slate-800 dark:text-slate-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Terms & Privacy</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>
                {/* Clear Notifications */}
                <button
                  onClick={() => setClearNotifModal(true)}
                  className="p-2 flex items-center justify-between group active:bg-slate-50 rounded-[14px] transition-colors text-left w-full dark:active:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 dark:bg-slate-800 dark:text-slate-400">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Clear Notifications</span>
                      <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">{notifications.length} stored</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>
              </div>
            </div>

            {/* 5. Sign Out Button */}
            <div className="animate-fade-in animate-delay-400 shrink-0 mt-2">
              <button
                onClick={() => setSignOutModal(true)}
                className="w-full bg-white border border-rose-100 hover:bg-rose-50 text-rose-500 py-3.5 rounded-[20px] text-[13px] font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(244,63,94,0.05)] active:scale-95 transition-all dark:bg-slate-900 dark:border-rose-900/50"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
              <div className="text-center mt-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Phonicity v2.4.1</span>
              </div>
            </div>

            {/* Saved toast */}
            {saved && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 rounded-[14px] bg-slate-900 px-4 py-3 text-white shadow-2xl dark:bg-slate-700">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-[12px] font-bold">Settings Saved</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DESKTOP VIEW                                */}
      {/* ========================================== */}
      {isDesktop && (
        <div className="hidden lg:block">
          <div className="p-8 pb-8 flex flex-col gap-5 max-w-[1200px] mx-auto">
            {/* Page Header */}
            <div>
              <h1 className="text-[24px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Settings</h1>
              <p className="text-[13px] font-medium text-slate-500 mt-0.5">Manage your organization's configuration and personal preferences.</p>
            </div>

            <div className="grid grid-cols-12 gap-5">
              {/* Left Column: Profile & Account */}
              <div className="col-span-7 flex flex-col gap-5">
                {/* Profile Card */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-5 dark:bg-slate-900 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[16px] font-bold text-slate-800 tracking-tight dark:text-slate-100">Personal Details</h3>
                    <button
                      onClick={() => setEditingProfile((v) => !v)}
                      className="h-9 px-3 rounded-[10px] bg-slate-50 border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-indigo-50 flex items-center justify-center dark:bg-indigo-900/30 dark:border-slate-700">
                      {user.avatar && user.avatar.startsWith('http') ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[20px] font-extrabold text-indigo-600 dark:text-indigo-400">{getInitials(user.name)}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="text-[18px] font-extrabold text-slate-800 dark:text-slate-100">{user.name}</h4>
                      <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{user.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400">Personal</span>
                        <button onClick={handleCopyAccount} className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1">
                          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          {accountNumber}
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingProfile && (
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-700/50">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Full Name</label>
                          <input
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[12px] px-3 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Email Address</label>
                          <input
                            value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[12px] px-3 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Professional Bio</label>
                        <input
                          value={draft.bio}
                          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                          placeholder="Tell us about your role"
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[12px] px-3 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                        />
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => { setEditingProfile(false); setDraft({ ...draft, name: user.name, email: user.email, bio: user.bio ?? '' }); }}
                          className="h-10 px-4 bg-slate-50 border border-slate-200 rounded-[12px] text-[13px] font-bold text-slate-600 active:scale-95 transition-transform dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handleSave}
                          className="h-10 px-4 bg-indigo-600 text-white rounded-[12px] text-[13px] font-bold active:scale-95 transition-transform flex items-center gap-1.5"
                        >
                          {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security & Sessions */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] overflow-hidden dark:bg-slate-900 dark:border-slate-700/50">
                  <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-700/50">
                    <h3 className="text-[16px] font-bold text-slate-800 tracking-tight dark:text-slate-100">Security & Access</h3>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3">
                      <currentSession.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{currentSession.device}</span>
                        <span className="text-[12px] text-slate-500 dark:text-slate-400">{currentSession.location}</span>
                      </div>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Active Now
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telegram */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-5 dark:bg-slate-900 dark:border-slate-700/50">
                  <h3 className="text-[16px] font-bold text-slate-800 tracking-tight mb-4 dark:text-slate-100">Telegram</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[10px] bg-sky-50 flex items-center justify-center text-sky-500 dark:bg-sky-900/20 dark:text-sky-400">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Telegram</span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          {telegram.loading ? 'Loading...' : telegram.linked ? (telegram.enabled ? 'Linked & Active' : 'Linked — Notifications Off') : 'Not linked'}
                        </span>
                      </div>
                    </div>
                    {telegram.loading ? null : telegram.linked ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">Telegram Notifications</span>
                          <button
                            onClick={handleToggleTelegram}
                            className={cn(
                              'relative inline-block w-11 align-middle select-none transition duration-200 ease-in h-6 rounded-full cursor-pointer',
                              telegram.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white border-4 transition-all duration-300 shadow-sm',
                                telegram.enabled ? 'translate-x-5 border-indigo-600' : 'border-slate-200 dark:border-slate-700'
                              )}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-slate-400">Chat ID</span>
                            <span className="text-[12px] font-mono text-slate-600 dark:text-slate-300">{telegram.chatId}</span>
                          </div>
                          <button
                            onClick={handleUnlinkTelegram}
                            disabled={telegram.unlinking}
                            className="flex items-center gap-1.5 h-9 px-3 bg-red-50 text-red-600 rounded-[10px] text-[12px] font-bold active:scale-95 transition-transform disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                          >
                            {telegram.unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                            Unlink
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-1">
                        {telegram.linking && (
                          <div className="flex items-center gap-2 text-[12px] text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Linking...
                          </div>
                        )}
                        {telegram.error && (
                          <span className="text-[11px] text-red-500 text-center">{telegram.error}</span>
                        )}
                        {telegram.botUsername && !telegram.linking && (
                          <TelegramLoginWidget
                            botUsername={telegram.botUsername}
                            onAuth={handleTelegramAuth}
                            size="large"
                          />
                        )}
                        {!telegram.botUsername && !telegram.linking && (
                          <span className="text-[11px] text-slate-400 text-center">Bot not configured. Set TELEGRAM_BOT_TOKEN.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Preferences & Appearance */}
              <div className="col-span-5 flex flex-col gap-5">
                {/* Appearance */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-5 dark:bg-slate-900 dark:border-slate-700/50">
                  <h3 className="text-[16px] font-bold text-slate-800 tracking-tight mb-4 dark:text-slate-100">Appearance</h3>
                  <div className="flex flex-col gap-2">
                    {themes.map((t) => {
                      const Icon = t.icon;
                      const active = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as typeof theme)}
                          className={cn(
                            'flex items-center justify-between rounded-[14px] border-2 p-3.5 transition-all',
                            active
                              ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-900/20'
                              : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-700'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-[10px] flex items-center justify-center',
                              active ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className={cn(
                              'text-[14px] font-bold',
                              active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                            )}>{t.label}</span>
                          </div>
                          {active && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-5 dark:bg-slate-900 dark:border-slate-700/50">
                  <h3 className="text-[16px] font-bold text-slate-800 tracking-tight mb-4 dark:text-slate-100">Notifications</h3>
                  <div className="flex flex-col gap-3">
                    {/* Push Notifications */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[10px] bg-amber-50 flex items-center justify-center text-amber-500 dark:bg-amber-900/20 dark:text-amber-400">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Push Notifications</span>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Calls & Messages alerts</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setPushNotifications(!pushNotifications)}
                        className={cn(
                          'relative inline-block w-11 align-middle select-none transition duration-200 ease-in h-6 rounded-full cursor-pointer',
                          pushNotifications ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white border-4 transition-all duration-300 shadow-sm',
                            pushNotifications ? 'translate-x-5 border-indigo-600' : 'border-slate-200 dark:border-slate-700'
                          )}
                        />
                      </button>
                    </div>
                    {/* Email Alerts */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[10px] bg-sky-50 flex items-center justify-center text-sky-500 dark:bg-sky-900/20 dark:text-sky-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Email Alerts</span>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Billing & Usage reports</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setEmailAlerts(!emailAlerts)}
                        className={cn(
                          'relative inline-block w-11 align-middle select-none transition duration-200 ease-in h-6 rounded-full cursor-pointer',
                          emailAlerts ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white border-4 transition-all duration-300 shadow-sm',
                            emailAlerts ? 'translate-x-5 border-indigo-600' : 'border-slate-200 dark:border-slate-700'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 mt-4 pt-4 dark:border-slate-700/50">
                    <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-slate-400">
                      You have {notifications.length} stored notification{notifications.length === 1 ? '' : 's'}.
                    </p>
                    <button
                      onClick={() => setClearNotifModal(true)}
                      className="text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 dark:text-indigo-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear All Notifications
                    </button>
                  </div>
                </div>

                {/* Sign Out */}
                <button
                  onClick={() => setSignOutModal(true)}
                  className="w-full bg-white border border-rose-100 hover:bg-rose-50 text-rose-500 py-3.5 rounded-[20px] text-[14px] font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(244,63,94,0.05)] active:scale-95 transition-all dark:bg-slate-900 dark:border-rose-900/50"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SIGN OUT CONFIRMATION MODAL                 */}
      {/* ========================================== */}
      {signOutModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSignOutModal(false)}
          />
          <div className="relative flex w-full flex-col rounded-t-[28px] bg-white pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900 max-w-[430px] mx-auto">
            {/* Drag Handle */}
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-4 dark:bg-slate-700" />

            <div className="px-5 flex flex-col gap-4 text-center items-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-1 dark:bg-rose-900/20">
                <LogOut className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight dark:text-slate-100">Sign Out</h2>
                <p className="text-[12px] font-medium text-slate-500 mt-2 leading-relaxed max-w-[280px] dark:text-slate-400">
                  Are you sure you want to sign out of your account? You will need to log back in to access your calls and messages.
                </p>
              </div>

              <div className="w-full flex flex-col gap-2.5 mt-2">
                <button
                  onClick={handleLogout}
                  className="w-full h-12 bg-rose-500 text-white rounded-[16px] text-[14px] font-extrabold flex items-center justify-center active:scale-95 transition-all shadow-[0_8px_20px_rgba(244,63,94,0.25)]"
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setSignOutModal(false)}
                  className="w-full h-12 bg-slate-50 text-slate-600 rounded-[16px] text-[14px] font-extrabold flex items-center justify-center active:scale-95 transition-all border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* HELP CENTER MODAL                           */}
      {/* ========================================== */}
      {helpCenterModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setHelpCenterModal(false)}
          />
          <div className="relative flex w-full flex-col rounded-t-[28px] bg-white pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900 max-w-[430px] mx-auto max-h-[85vh]">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-4 dark:bg-slate-700" />
            <div className="px-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[14px] bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight dark:text-slate-100">Help Center</h2>
                  <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Find answers and get support</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { icon: Mail, title: 'Contact Support', desc: 'Reach our team via email' },
                  { icon: HelpCircle, title: 'FAQs', desc: 'Frequently asked questions' },
                  { icon: Phone, title: 'Call Us', desc: '+1 (800) 555-0199' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-[14px] border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                    <div className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center text-slate-600 shrink-0 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{item.title}</span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.desc}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setHelpCenterModal(false)}
                className="w-full h-12 bg-slate-50 text-slate-600 rounded-[16px] text-[14px] font-extrabold flex items-center justify-center active:scale-95 transition-all border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TERMS & PRIVACY MODAL                       */}
      {/* ========================================== */}
      {termsPrivacyModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setTermsPrivacyModal(false)}
          />
          <div className="relative flex w-full flex-col rounded-t-[28px] bg-white pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900 max-w-[430px] mx-auto max-h-[85vh]">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-4 dark:bg-slate-700" />
            <div className="px-5 flex flex-col gap-4 flex-grow overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-12 h-12 rounded-[14px] bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight dark:text-slate-100">Terms & Privacy</h2>
                  <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Last updated: July 2026</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 text-[12px] font-medium text-slate-600 leading-relaxed dark:text-slate-300">
                <div>
                  <h3 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 mb-1">Terms of Service</h3>
                  <p>By using Phonicity, you agree to our terms of service. You are responsible for maintaining the security of your account and for all activities that occur under your account.</p>
                </div>
                <div>
                  <h3 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 mb-1">Privacy Policy</h3>
                  <p>We respect your privacy and are committed to protecting your personal data. We collect only the information necessary to provide our services and do not share your data with third parties without consent.</p>
                </div>
                <div>
                  <h3 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 mb-1">Data Retention</h3>
                  <p>Your call logs and messages are retained for 90 days. You may request data deletion at any time by contacting support.</p>
                </div>
                <div>
                  <h3 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 mb-1">Acceptable Use</h3>
                  <p>You agree not to use Phonicity for unlawful activities, spam, or harassment. Violations may result in account termination.</p>
                </div>
              </div>
              <button
                onClick={() => setTermsPrivacyModal(false)}
                className="w-full h-12 bg-slate-50 text-slate-600 rounded-[16px] text-[14px] font-extrabold flex items-center justify-center active:scale-95 transition-all border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* CLEAR NOTIFICATIONS MODAL                   */}
      {/* ========================================== */}
      {clearNotifModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setClearNotifModal(false)}
          />
          <div className="relative flex w-full flex-col rounded-t-[28px] bg-white pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900 max-w-[430px] mx-auto">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-4 dark:bg-slate-700" />

            <div className="px-5 flex flex-col gap-4 text-center items-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-1 dark:bg-rose-900/20">
                <RotateCcw className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight dark:text-slate-100">Clear Notifications</h2>
                <p className="text-[12px] font-medium text-slate-500 mt-2 leading-relaxed max-w-[280px] dark:text-slate-400">
                  Are you sure you want to clear all {notifications.length} notification{notifications.length === 1 ? '' : 's'}? This action cannot be undone.
                </p>
              </div>

              <div className="w-full flex flex-col gap-2.5 mt-2">
                <button
                  onClick={() => { clearNotifications(); setClearNotifModal(false); }}
                  className="w-full h-12 bg-rose-500 text-white rounded-[16px] text-[14px] font-extrabold flex items-center justify-center active:scale-95 transition-all shadow-[0_8px_20px_rgba(244,63,94,0.25)]"
                >
                  Yes, Clear All
                </button>
                <button
                  onClick={() => setClearNotifModal(false)}
                  className="w-full h-12 bg-slate-50 text-slate-600 rounded-[16px] text-[14px] font-extrabold flex items-center justify-center active:scale-95 transition-all border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(Settings);
