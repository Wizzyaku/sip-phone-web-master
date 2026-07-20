import { useEffect, useRef, useState, useMemo, memo } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  Play,
  Info,
  Search,
  Grid3x3,
  X,
  Delete,
  ChevronDown,
  Loader2,
  Settings,
  History,
  Timer,
  Disc,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { useSipContext } from '../context/SipContext';
import { saveSipCredentials } from '../lib/sipCredentials';
import { lookupUserByPhone, type DirectoryUser } from '../lib/directory';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { LowBalanceModal } from '../components/LowBalanceModal';
import { hasEnoughBalance } from '../lib/balance';
import { fetchCallLogs, insertCallLog } from '../lib/callLogs';

const keypad = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '+', sub: '' },
  { digit: '0', sub: '' },
  { digit: '#', sub: '' },
];

type CallType = 'incoming' | 'outgoing' | 'missed' | 'voicemail';
type RecentFilter = 'all' | 'missed' | 'voicemail' | 'recorded';

interface CallRecord {
  id: string;
  name: string;
  phone: string;
  time: string;
  duration: string;
  type: CallType;
  recorded: boolean;
  date: Date;
}

function formatCallTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)m\s+(\d+)s/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function Calls() {
  const isDesktop = useIsDesktop();
  const { status, error, activeCall, register, call } = useSipContext();
  const telnyxNumber = useAppStore((s) => s.telnyxNumber);

  const sipSettings = useAppStore((s) => s.sipSettings);
  const setSipSettings = useAppStore((s) => s.setSipSettings);
  const [settings, setSettings] = useState({
    username: sipSettings?.username || '',
    password: sipSettings?.password || '',
    phoneNumber: sipSettings?.phoneNumber || telnyxNumber || '',
  });
  const [number, setNumber] = useState('');
  const [directoryUser, setDirectoryUser] = useState<DirectoryUser | null>(null);
  const [recentFilter, setRecentFilter] = useState<RecentFilter>('all');
  const [recentPage, setRecentPage] = useState(1);
  const [recentLoading, setRecentLoading] = useState(true);
  const recentPageSize = 5;

  useEffect(() => {
    setRecentPage(1);
  }, [recentFilter]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [lowBalanceOpen, setLowBalanceOpen] = useState(false);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      const logs = await fetchCallLogs(50);
      const records: CallRecord[] = logs.map((log) => {
        const mins = Math.floor(log.duration_seconds / 60);
        const secs = log.duration_seconds % 60;
        return {
          id: log.id,
          name: log.remote_identity,
          phone: log.remote_identity,
          time: formatCallTime(new Date(log.created_at)),
          duration: `${mins}m ${secs.toString().padStart(2, '0')}s`,
          type: log.type,
          recorded: log.recorded,
          date: new Date(log.created_at),
        };
      });
      setCallHistory(records);
      setRecentLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!number.trim()) {
      setDirectoryUser(null);
      return;
    }
    lookupUserByPhone(number.trim()).then((user) => {
      if (!cancelled) setDirectoryUser(user);
    });
    return () => {
      cancelled = true;
    };
  }, [number]);

  const prevActiveCallRef = useRef(activeCall);
  useEffect(() => {
    if (prevActiveCallRef.current && !activeCall) {
      const ended = prevActiveCallRef.current;
      const durationSeconds = ended.durationSeconds || 0;
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      const durationStr = `${mins}m ${secs.toString().padStart(2, '0')}s`;
      const callType = ended.direction === 'incoming' && durationSeconds === 0 ? 'missed' : ended.direction;
      const newRecord: CallRecord = {
        id: crypto.randomUUID(),
        name: ended.remoteIdentity,
        phone: ended.remoteIdentity,
        time: formatCallTime(new Date()),
        duration: durationStr,
        type: callType,
        recorded: false,
        date: new Date(),
      };
      setCallHistory((prev) => [newRecord, ...prev]);
      insertCallLog(ended.remoteIdentity, ended.direction, callType, durationSeconds, false);
    }
    prevActiveCallRef.current = activeCall;
  }, [activeCall]);

  const filteredCalls = useMemo(() => {
    let filtered = callHistory;
    if (recentFilter === 'missed') filtered = callHistory.filter((c) => c.type === 'missed');
    if (recentFilter === 'voicemail') filtered = callHistory.filter((c) => c.type === 'voicemail');
    if (recentFilter === 'recorded') filtered = callHistory.filter((c) => c.recorded);
    if (searchQuery.trim()) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    const totalPages = Math.ceil(filtered.length / recentPageSize) || 1;
    const page = Math.min(recentPage, totalPages);
    return filtered.slice((page - 1) * recentPageSize, page * recentPageSize);
  }, [callHistory, recentFilter, recentPage, searchQuery]);

  const recentTotalPages = useMemo(() => {
    let filtered = callHistory;
    if (recentFilter === 'missed') filtered = callHistory.filter((c) => c.type === 'missed');
    if (recentFilter === 'voicemail') filtered = callHistory.filter((c) => c.type === 'voicemail');
    if (recentFilter === 'recorded') filtered = callHistory.filter((c) => c.recorded);
    if (searchQuery.trim()) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return Math.ceil(filtered.length / recentPageSize) || 1;
  }, [callHistory, recentFilter, searchQuery]);

  const stats = useMemo(() => {
    const completed = callHistory.filter((c) => c.type !== 'missed');
    const totalSeconds = completed.reduce((sum, c) => sum + parseDuration(c.duration), 0);
    const avg = completed.length ? Math.round(totalSeconds / completed.length) : 0;
    const mins = Math.floor(avg / 60);
    const secs = avg % 60;
    return {
      avgDuration: `${mins}m ${secs.toString().padStart(2, '0')}s`,
      recordings: callHistory.filter((c) => c.recorded).length,
    };
  }, [callHistory]);

  const callIconConfig = (type: CallType) => {
    switch (type) {
      case 'missed': return { Icon: PhoneMissed, bg: 'bg-rose-50', color: 'text-rose-500', nameColor: 'text-rose-600' };
      case 'incoming': return { Icon: PhoneIncoming, bg: 'bg-slate-100', color: 'text-slate-500', nameColor: 'text-slate-800' };
      case 'outgoing': return { Icon: PhoneOutgoing, bg: 'bg-indigo-50', color: 'text-indigo-600', nameColor: 'text-slate-800' };
      case 'voicemail': return { Icon: Voicemail, bg: 'bg-amber-50', color: 'text-amber-500', nameColor: 'text-slate-800' };
    }
  };

  const handleDial = (digit: string) => {
    if (number.length < 16) setNumber((n) => n + digit);
  };
  const handleBackspace = () => setNumber((n) => n.slice(0, -1));
  const handleClear = () => setNumber('');
  const handleCall = async () => {
    if (!number.trim()) return;
    const balance = useAppStore.getState().balance;
    if (!hasEnoughBalance(balance)) {
      setLowBalanceOpen(true);
      return;
    }
    const target = directoryUser
      ? `sip:${directoryUser.sipUsername}@sip.telnyx.com`
      : number.trim();
    call(target);
  };

  const activeLine = telnyxNumber || settings.phoneNumber || 'No number assigned';

  const tabs: { id: RecentFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'missed', label: 'Missed' },
    { id: 'voicemail', label: 'Voicemail' },
    { id: 'recorded', label: 'Recorded' },
  ];

  const formattedDial = useMemo(() => {
    const hasPlus = number.startsWith('+');
    const digits = number.replace(/\D/g, '');
    if (hasPlus) return '+' + digits;
    if (digits.length > 6) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
    return digits;
  }, [number]);

  const filterChips = [
    { id: 'all' as const, label: 'All' },
    { id: 'missed' as const, label: 'Missed' },
    { id: 'voicemail' as const, label: 'Voicemail' },
    { id: 'recorded' as const, label: 'Recorded' },
  ];

  function MobileCalls() {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[#F0F4F8] dark:bg-slate-950">
        <div className="px-4 pt-3 pb-[10px] flex flex-col gap-3.5">
          {/* Search & Filters */}
          <div className="animate-fade-in shrink-0 flex flex-col gap-3">
            <div className="relative w-full shadow-[0_2px_8px_rgba(15,23,42,0.02)]">
              <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px] my-auto" />
              <input
                type="text"
                placeholder="Search callers or numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {filterChips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setRecentFilter(chip.id)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm transition-all active:scale-95',
                    recentFilter === chip.id
                      ? 'bg-slate-800 text-white dark:bg-indigo-600'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Call Logs */}
          <div className="animate-fade-in animate-delay-100 shrink-0 flex flex-col gap-2.5 mt-1">
            {recentLoading ? (
              <div className="flex flex-col gap-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white border border-slate-200/80 rounded-[20px] p-3.5 flex items-center gap-3 dark:bg-slate-900 dark:border-slate-700/50">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32 rounded" />
                      <Skeleton className="h-2 w-20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Phone className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-400">No calls found</p>
              </div>
            ) : (
              <>
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Today</h3>
                {filteredCalls.map((callItem) => {
                  const cfg = callIconConfig(callItem.type);
                  const Icon = cfg.Icon;
                  const subLabel = callItem.type === 'missed'
                    ? 'Missed Call'
                    : callItem.type === 'voicemail'
                    ? `Voicemail (${callItem.duration.replace('m ', ':').replace('s', '')})`
                    : callItem.duration;
                  return (
                    <div
                      key={callItem.id}
                      className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 flex items-center justify-between active:bg-slate-50 transition-colors dark:bg-slate-900 dark:border-slate-700/50 dark:active:bg-slate-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', cfg.bg)}>
                          <Icon className={cn('w-[18px] h-[18px]', cfg.color)} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className={cn('text-[14px] font-extrabold truncate', cfg.nameColor, 'dark:text-slate-100')}>{callItem.name}</h4>
                          <span className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">{subLabel}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-extrabold text-slate-400">{callItem.time}</span>
                        {callItem.type === 'voicemail' ? (
                          <button className="w-7 h-7 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 flex items-center justify-center transition-colors active:scale-95 shadow-sm">
                            <Play className="w-3.5 h-3.5" fill="currentColor" />
                          </button>
                        ) : (
                          <button
                            className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors active:scale-95"
                            onClick={() => { setNumber(callItem.phone); setDialerOpen(true); }}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="text-center mt-2 opacity-50">
                  <span className="text-[10px] font-bold text-slate-500">End of recent calls</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Floating Dialer FAB */}
        <button
          onClick={() => setDialerOpen(true)}
          className="fixed bottom-24 right-5 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[18px] flex items-center justify-center shadow-[0_8px_25px_rgba(79,70,229,0.4)] z-40 active:scale-90 transition-transform lg:hidden"
        >
          <Grid3x3 className="w-6 h-6" />
        </button>

        {/* Dialer Bottom Sheet */}
        {dialerOpen && (
          <div className="lg:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDialerOpen(false)} />
            <div className="absolute left-0 right-0 bottom-0 h-[85dvh] bg-white rounded-t-[32px] flex flex-col dark:bg-slate-900">
              {/* Header */}
              <div className="shrink-0 pt-3 pb-2 flex flex-col items-center relative border-b border-slate-50 dark:border-slate-700">
                <div className="w-10 h-1.5 bg-slate-200 rounded-full mb-3 dark:bg-slate-700" />
                <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-[12px] transition-colors active:scale-95 dark:bg-slate-800 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">From:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{activeLine}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
                <button onClick={() => setDialerOpen(false)} className="absolute top-4 right-4 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 active:scale-95 dark:bg-slate-800">
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>

              {/* Number Display */}
              <div className="shrink-0 h-24 flex items-center justify-center px-6 relative">
                <h2 className="text-[36px] font-extrabold text-slate-800 dark:text-slate-100 tracking-wider">{formattedDial}</h2>
                {number.length > 0 && (
                  <button className="absolute top-2 text-[11px] font-extrabold text-indigo-600 flex items-center gap-1">
                    + Add Number
                  </button>
                )}
              </div>

              {/* Keypad */}
              <div className="flex-grow flex flex-col justify-end px-8 pb-10">
                <div className="grid grid-cols-3 gap-y-4 gap-x-8 max-w-[320px] mx-auto w-full">
                  {keypad.map((item) => (
                    <button
                      key={item.digit}
                      onClick={() => handleDial(item.digit)}
                      disabled={!!activeCall}
                      className="dial-key w-[72px] h-[72px] mx-auto rounded-full bg-slate-50 flex flex-col items-center justify-center transition-colors active:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:active:bg-slate-700"
                    >
                      <span className="text-[28px] font-medium text-slate-800 dark:text-slate-100 leading-none">{item.digit}</span>
                      {item.sub && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.sub}</span>}
                    </button>
                  ))}
                </div>

                {/* Call Actions */}
                <div className="grid grid-cols-3 gap-x-8 max-w-[320px] mx-auto w-full mt-6 items-center">
                  <div />
                  <button
                    onClick={handleCall}
                    disabled={!!activeCall || !number.trim()}
                    className="w-[72px] h-[72px] mx-auto rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white shadow-[0_8px_20px_rgba(16,185,129,0.4)] active:scale-90 transition-transform disabled:opacity-50"
                  >
                    <Phone className="w-8 h-8" fill="currentColor" />
                  </button>
                  <button
                    onClick={handleBackspace}
                    disabled={!number}
                    className={cn(
                      'w-[72px] h-[72px] mx-auto rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors active:scale-90 disabled:opacity-0 disabled:pointer-events-none dark:text-slate-500'
                    )}
                  >
                    <Delete className="w-7 h-7" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {!isDesktop && <MobileCalls />}
      {isDesktop && (
        <div className="hidden lg:block p-8 pb-8 bg-[#F0F4F8] dark:bg-slate-950 min-h-full">
          {/* Header */}
          <div className="mb-8 flex flex-row items-end justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Recent Calls</h2>
              <p className="text-sm text-slate-500 mt-1">Manage call history and dial new numbers.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search callers or numbers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-64 bg-white border border-slate-200 rounded-xl pl-10 pr-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <Settings className="w-4 h-4" /> SIP Settings
              </button>
            </div>
          </div>

          {/* Active Line & SIP Status */}
          <div className="mb-6 premium-card rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Active Line</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{activeLine}</h3>
                  <ChevronDown className="w-4 h-4 text-slate-400 cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('h-2.5 w-2.5 rounded-full', status === 'registered' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-yellow-500')} />
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Status: {status}</span>
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
          </div>

          {/* SIP Settings Panel */}
          {showSettings && (
            <div className="mb-6 premium-card rounded-2xl p-5 flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <input
                  placeholder="SIP Username"
                  value={settings.username}
                  onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                  className="h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
                <div className="relative">
                  <input
                    type={showSipPassword ? 'text' : 'password'}
                    placeholder="SIP Password"
                    value={settings.password}
                    onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                    className="h-11 w-full bg-white border border-slate-200 rounded-xl px-3 pr-10 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSipPassword(!showSipPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showSipPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <input
                  placeholder="Phone Number (e.g. +12125551234)"
                  value={settings.phoneNumber}
                  onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                  className="h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    setSipSettings(settings);
                    await saveSipCredentials(settings);
                    register(settings);
                  }}
                  disabled={status === 'connecting' || status === 'registered'}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all',
                    status === 'registered'
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:bg-indigo-500 active:scale-95'
                  )}
                >
                  {status === 'connecting' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === 'registered' ? 'Registered' : status === 'connecting' ? 'Connecting...' : 'Register'}
                </button>
              </div>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Recent Calls List */}
            <div className="col-span-7">
              <div className="premium-card rounded-2xl flex flex-col min-h-[500px] overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 p-5">
                  <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-slate-100">
                    <History className="w-5 h-5 text-indigo-600" /> Recent Calls
                  </h3>
                  <div className="flex gap-1.5">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setRecentFilter(t.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                          recentFilter === t.id
                            ? 'bg-slate-800 text-white dark:bg-indigo-600 shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {recentLoading ? (
                    <div className="flex flex-col gap-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-700">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                          <Skeleton className="h-8 w-20 rounded-lg" />
                        </div>
                      ))}
                    </div>
                  ) : filteredCalls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Phone className="mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-400">No calls found</p>
                    </div>
                  ) : (
                    filteredCalls.map((callItem) => {
                      const cfg = callIconConfig(callItem.type);
                      const Icon = cfg.Icon;
                      return (
                        <div
                          key={callItem.id}
                          className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-slate-100 p-4 transition-all hover:bg-slate-50 hover:shadow-sm dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', cfg.bg)}>
                            <Icon className={cn('h-5 w-5', cfg.color)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn('truncate font-extrabold', cfg.nameColor, 'dark:text-slate-100')}>{callItem.name}</h4>
                            <p className="text-xs font-medium text-slate-500">{callItem.phone} • {callItem.duration}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-slate-400 font-bold">{callItem.time}</span>
                            <div className="flex gap-1.5">
                              {callItem.recorded && (
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100" title="Playback">
                                  <Play className="h-4 w-4" />
                                </button>
                              )}
                              {callItem.type === 'voicemail' && (
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 shadow-sm" title="Play Voicemail">
                                  <Play className="h-4 w-4" fill="currentColor" />
                                </button>
                              )}
                              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                                <Info className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {recentTotalPages > 1 && (
                  <div className="border-t border-slate-100 dark:border-slate-700 p-4 flex items-center justify-between">
                    <button
                      onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                      disabled={recentPage === 1}
                      className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-bold text-slate-400">{recentPage} / {recentTotalPages}</span>
                    <button
                      onClick={() => setRecentPage((p) => Math.min(recentTotalPages, p + 1))}
                      disabled={recentPage === recentTotalPages}
                      className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Stats + Dialer */}
            <div className="col-span-5 flex flex-col gap-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="premium-card rounded-2xl p-5 flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                    <Timer className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Avg Duration</span>
                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{stats.avgDuration}</h3>
                </div>
                <div className="premium-card rounded-2xl p-5 flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Disc className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Recordings</span>
                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{stats.recordings}</h3>
                </div>
              </div>

              {/* Dial Pad */}
              <div className="premium-card rounded-2xl p-6 flex flex-col items-center">
                <div className="mb-4 w-full text-center">
                  <h3 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Manual Entry</h3>
                  <div className="flex h-14 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50 px-4 dark:bg-slate-800">
                    <span className="truncate text-2xl font-extrabold tracking-wider text-slate-800 dark:text-slate-100">{formattedDial}</span>
                    <span className={cn('ml-1 h-7 w-0.5 bg-indigo-400/30', number.length < 15 && 'animate-pulse')} />
                  </div>
                  {directoryUser ? (
                    <p className="mt-1.5 text-xs font-medium text-indigo-600">{directoryUser.name} is an app user — will ring in their browser</p>
                  ) : number.trim().length >= 7 ? (
                    <p className="mt-1.5 text-xs text-slate-400">External number</p>
                  ) : null}
                </div>
                <div className="grid w-full max-w-[280px] grid-cols-3 gap-x-4 gap-y-3">
                  {keypad.map((item) => (
                    <button
                      key={item.digit}
                      onClick={() => handleDial(item.digit)}
                      disabled={!!activeCall}
                      className={cn(
                        'flex h-14 w-14 mx-auto flex-col items-center justify-center rounded-full bg-slate-50 border border-slate-100 shadow-sm transition-all hover:border-indigo-300 active:scale-95 active:bg-indigo-50 dark:bg-slate-800 dark:border-slate-700',
                        activeCall && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{item.digit}</span>
                      {item.sub && <span className="text-[9px] font-bold uppercase text-slate-400">{item.sub}</span>}
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex w-full items-center justify-center gap-5">
                  <button
                    onClick={number ? handleBackspace : handleClear}
                    disabled={!number}
                    className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm hover:text-slate-600 transition-colors active:scale-95 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700"
                  >
                    <Delete className="w-5 h-5 mx-auto" />
                  </button>
                  <button
                    onClick={handleCall}
                    disabled={!!activeCall || !number.trim()}
                    className="w-16 h-16 rounded-full bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.4)] hover:bg-emerald-400 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center"
                  >
                    <Phone className="w-7 h-7" fill="currentColor" />
                  </button>
                  <div className="w-12 h-12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <LowBalanceModal
        open={lowBalanceOpen}
        onClose={() => setLowBalanceOpen(false)}
        action="call"
      />
    </>
  );
}

export default memo(Calls);
