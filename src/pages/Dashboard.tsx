import { useMemo, memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  QrCode,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  MessageSquare,
  PhoneOutgoing,
  Copy,
  MoreVertical,
  Wallet,
  RefreshCw,
  X,
  Coins,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useSipContext } from '../context/SipContext';
import { formatTokens, formatCurrency, TOKEN_PACKAGES } from '../lib/balance';
import { cn } from '../lib/utils';
import { BuyNumberModal } from '../components/BuyNumberModal';
import { fetchUserPhoneNumbers, type PhoneNumberRecord } from '../lib/phoneNumbers';
import { fetchCallLogs, type CallLogRecord } from '../lib/callLogs';
import { fetchTransactions, type Transaction } from '../lib/balance';
import { supabase } from '../lib/supabase';

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getCountdown(billingDate: string | null): { days: number; hours: number; minutes: number; expired: boolean } | null {
  if (!billingDate) return null;
  const target = new Date(billingDate).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, expired: false };
}

function formatCountdown(c: { days: number; hours: number; minutes: number }): string {
  if (c.days > 0) return `${c.days}d ${c.hours}h ${c.minutes}m`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m`;
  return `${c.minutes}m`;
}

function buildTrend(callLogs: CallLogRecord[], messages: { createdAt: string; type: string }[]) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const counts = days.map((_, i) => {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - (6 - i));
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const callCount = callLogs.filter((c) => {
      const d = new Date(c.created_at);
      return d >= dayStart && d <= dayEnd;
    }).length;
    const smsCount = messages.filter((m) => {
      const d = new Date(m.createdAt);
      return d >= dayStart && d <= dayEnd;
    }).length;
    return callCount + smsCount;
  });
  const max = Math.max(...counts, 1);
  return { days, counts, max };
}

export function Dashboard() {
  const messages = useAppStore((s) => s.messages);
  const user = useAppStore((s) => s.user);
  const balance = useAppStore((s) => s.balance);
  const balanceLoading = useAppStore((s) => s.balanceLoading);
  const navigate = useNavigate();
  const { call } = useSipContext();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [buyNumberOpen, setBuyNumberOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<number>(1);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberRecord[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [numbers, logs, txns] = await Promise.all([
        fetchUserPhoneNumbers(),
        fetchCallLogs(20),
        fetchTransactions(),
      ]);
      setPhoneNumbers(numbers);
      setCallLogs(logs);
      setTransactions(txns);
    };
    loadData();
  }, []);

  const trend = useMemo(() => buildTrend(callLogs, messages), [callLogs, messages]);

  const activity = useMemo(() => {
    const items: { id: string; title: string; description: string; time: string; type: string }[] = [];

    for (const m of messages.slice(0, 3)) {
      const isInbound = m.direction === 'inbound';
      const isSms = m.type === 'text';
      if (isSms) {
        items.push({
          id: m.id,
          title: isInbound ? m.from || m.conversationId : m.to || m.conversationId,
          description: `"${m.body.substring(0, 25)}..."`,
          time: formatTime(m.createdAt),
          type: 'message',
        });
      }
    }

    for (const c of callLogs.slice(0, 5)) {
      const mins = Math.floor(c.duration_seconds / 60);
      const secs = c.duration_seconds % 60;
      const durationStr = `${mins}m ${secs.toString().padStart(2, '0')}s`;
      if (c.type === 'missed') {
        items.push({ id: c.id, title: c.remote_identity, description: 'Missed', time: formatTime(c.created_at), type: 'missed' });
      } else if (c.type === 'incoming') {
        items.push({ id: c.id, title: c.remote_identity, description: `In • ${durationStr}`, time: formatTime(c.created_at), type: 'incoming' });
      } else {
        items.push({ id: c.id, title: c.remote_identity, description: `Out • ${durationStr}`, time: formatTime(c.created_at), type: 'outgoing' });
      }
    }

    for (const t of transactions.slice(0, 5)) {
      if (t.status === 'success') {
        items.push({ id: t.id, title: 'Wallet Top Up', description: `+${formatTokens(t.tokens)} tokens`, time: formatTime(t.createdAt), type: 'topup' });
      }
    }

    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return items.slice(0, 5);
  }, [messages, callLogs, transactions]);

  const activeNumbers = phoneNumbers.filter((n) => n.active).length;
  const callCount = callLogs.filter((c) => c.type === 'incoming' || c.type === 'outgoing').length;
  const smsCount = messages.filter((m) => m.type === 'text').length;

  const handlePay = async () => {
    setPayError(null);
    const pkg = TOKEN_PACKAGES[selectedPackage];
    if (!pkg) {
      setPayError('Select a token package to continue.');
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setPayError('You must be signed in to add funds.');
      return;
    }

    setPaying(true);
    try {
      const response = await fetch('/api/korapay-initiate-charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageIndex: selectedPackage }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        reference?: string;
        error?: string;
        korapayMessage?: string;
      };

      if (!response.ok || data.error) {
        throw new Error(data.korapayMessage || data.error || 'Payment initialization failed.');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setPayError(message);
      setPaying(false);
    }
  };

  const isCallType = (type: string) => type === 'incoming' || type === 'outgoing' || type === 'missed';

  const handleActivityClick = (item: { id: string; type: string; title: string }) => {
    if (isCallType(item.type)) {
      setExpandedActivityId(expandedActivityId === item.id ? null : item.id);
    } else if (item.type === 'message') {
      navigate('/messages');
    }
  };

  const handleActivityCall = (phone: string) => {
    call(phone);
    setExpandedActivityId(null);
  };

  const handleActivityMessage = (phone: string) => {
    navigate(`/messages?to=${encodeURIComponent(phone)}`);
    setExpandedActivityId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F0F4F8] dark:bg-slate-950">
      {/* ========================================= */}
      {/* MOBILE LAYOUT (hidden on lg+)             */}
      {/* ========================================= */}
      <div className="lg:hidden px-4 pt-3 pb-[10px] flex flex-col gap-3.5">
        {/* 1. Hero / Wallet Card */}
        <div className="animate-fade-in shrink-0 relative overflow-hidden hero-card rounded-[20px] shadow-[0_8px_25px_rgba(15,23,42,0.15)] p-4 flex flex-col gap-4">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl z-0" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl z-0" />

          <div className="relative z-10 flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Credits</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[24px] font-extrabold text-white tracking-tight">
                  {balanceLoading || balance === null ? '...' : formatTokens(balance.tokens)}
                </span>
                <span className="text-[12px] font-bold text-slate-400">tokens</span>
              </div>
            </div>
            <button
              onClick={() => setTopUpOpen(true)}
              className="h-8 px-3.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-[10px] text-[10px] font-extrabold flex items-center gap-1.5 backdrop-blur-sm active:scale-95 transition-all"
            >
              <Coins className="w-3.5 h-3.5" /> Buy Tokens
            </button>
          </div>

          <div className="relative z-10 flex gap-2">
            <button
              onClick={() => setBuyNumberOpen(true)}
              className="flex-1 h-10 bg-indigo-500 hover:bg-indigo-400 text-white rounded-[12px] text-[12px] font-extrabold flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(99,102,241,0.3)] active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4" /> Buy Number
            </button>
            <button className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-[12px] flex items-center justify-center backdrop-blur-sm active:scale-95 transition-all">
              <QrCode className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* 2. Quick Stats Grid */}
        <div className="animate-fade-in animate-delay-100 shrink-0 grid grid-cols-3 gap-2.5">
          <div className="bg-white border border-slate-200/80 rounded-[16px] p-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.02)] flex flex-col items-center justify-center text-center dark:bg-slate-900 dark:border-slate-700/50">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Active</span>
            <h3 className="text-[18px] font-extrabold text-indigo-600 leading-none">{activeNumbers}</h3>
            <span className="text-[8.5px] font-bold text-slate-500 mt-1">Numbers</span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-[16px] p-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.02)] flex flex-col items-center justify-center text-center dark:bg-slate-900 dark:border-slate-700/50">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Calls</span>
            <h3 className="text-[18px] font-extrabold text-slate-800 dark:text-slate-100 leading-none">{callCount}</h3>
            <span className="text-[8.5px] font-bold text-slate-400 mt-1">Total</span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-[16px] p-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.02)] flex flex-col items-center justify-center text-center dark:bg-slate-900 dark:border-slate-700/50">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">SMS</span>
            <h3 className="text-[18px] font-extrabold text-slate-800 dark:text-slate-100 leading-none">{smsCount}</h3>
            <span className="text-[8.5px] font-bold text-slate-400 mt-1">Today</span>
          </div>
        </div>

        {/* 3. Your Numbers Section */}
        <div className="animate-fade-in animate-delay-200 shrink-0 flex flex-col gap-2.5 mt-1">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">Your Numbers</h3>
            <button
              onClick={() => navigate('/numbers')}
              className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Manage All
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {phoneNumbers.slice(0, 2).map((num) => {
              const countdown = getCountdown(num.next_billing_date);
              const isExpiringSoon = countdown && !countdown.expired && countdown.days <= 3;
              const isExpired = countdown?.expired;
              const showWarning = isExpiringSoon || isExpired;
              return (
              <div
                key={num.id}
                className="bg-white border border-slate-200/80 rounded-[16px] shadow-[0_2px_10px_rgba(15,23,42,0.02)] p-2.5 flex flex-col gap-2 active:bg-slate-50 transition-colors dark:bg-slate-900 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-[18px] flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                      {num.flag || '📞'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          {num.number}
                        </h4>
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', num.active ? 'bg-emerald-500' : 'bg-slate-300')} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 truncate">
                        {num.label || 'Phone Number'} • {num.features.join(', ') || 'SMS/Voice'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors active:scale-95 dark:bg-slate-800 dark:text-slate-400">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95 dark:bg-slate-800 dark:text-slate-400">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {showWarning && (
                  <div className={cn(
                    'rounded-[10px] px-2.5 py-2 flex items-center justify-between gap-2',
                    isExpired ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                  )}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className={cn('w-3.5 h-3.5 shrink-0', isExpired ? 'text-red-500' : 'text-amber-500')} />
                      <span className={cn('text-[9.5px] font-bold leading-tight', isExpired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                        {isExpired
                          ? 'Number expired — deposit now to restore'
                          : `Renewal in ${formatCountdown(countdown!)} — deposit to keep your number`}
                      </span>
                    </div>
                    <button
                      onClick={() => setTopUpOpen(true)}
                      className={cn(
                        'shrink-0 h-7 px-2.5 rounded-[8px] text-[10px] font-extrabold text-white active:scale-95 transition-transform flex items-center gap-1',
                        isExpired ? 'bg-red-500' : 'bg-amber-500'
                      )}
                    >
                      <Wallet className="w-3 h-3" />
                      Deposit
                    </button>
                  </div>
                )}
              </div>
              );
            })}

            {phoneNumbers.length === 0 && (
              <div className="bg-white border border-slate-200/80 rounded-[16px] shadow-[0_2px_10px_rgba(15,23,42,0.02)] p-4 flex flex-col items-center justify-center text-center dark:bg-slate-900 dark:border-slate-700/50">
                <Phone className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-[12px] font-bold text-slate-500">No phone numbers yet</p>
                <button
                  onClick={() => setBuyNumberOpen(true)}
                  className="mt-2 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Buy your first number
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. Recent Activity */}
        <div className="animate-fade-in animate-delay-300 shrink-0 flex flex-col gap-2.5 mt-2">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">Recent Activity</h3>
            <button onClick={() => navigate('/messages')} className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors">View All</button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-1.5 flex flex-col dark:bg-slate-900 dark:border-slate-700/50">
            {activity.map((item) => {
              let Icon = Phone;
              let bgClass = 'bg-indigo-50 text-indigo-600';
              if (item.type === 'incoming') { Icon = PhoneIncoming; bgClass = 'bg-indigo-50 text-indigo-600'; }
              if (item.type === 'missed') { Icon = PhoneMissed; bgClass = 'bg-rose-50 text-rose-600'; }
              if (item.type === 'message') { Icon = MessageSquare; bgClass = 'bg-indigo-50 text-indigo-600'; }
              if (item.type === 'outgoing') { Icon = PhoneOutgoing; bgClass = 'bg-emerald-50 text-emerald-600'; }
              if (item.type === 'topup') { Icon = Wallet; bgClass = 'bg-emerald-50 text-emerald-600'; }

              return (
                <div key={item.id} className="rounded-[14px] overflow-hidden">
                  <div
                    className="p-2 flex items-center justify-between active:bg-slate-50 rounded-[14px] transition-colors cursor-pointer dark:hover:bg-slate-800"
                    onClick={() => handleActivityClick(item)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', bgClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[180px]">
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold text-slate-400">{item.time}</span>
                  </div>
                  {expandedActivityId === item.id && isCallType(item.type) && (
                    <div className="px-2 pb-2 pt-0.5 flex gap-2 animate-fade-in">
                      <button
                        onClick={() => handleActivityCall(item.title)}
                        className="flex-1 h-9 rounded-[12px] bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </button>
                      <button
                        onClick={() => handleActivityMessage(item.title)}
                        className="flex-1 h-9 rounded-[12px] bg-indigo-50 text-indigo-600 font-bold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform dark:bg-indigo-900/30 dark:text-indigo-400"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Message
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* DESKTOP LAYOUT (hidden below lg)          */}
      {/* ========================================= */}
      <div className="hidden lg:block p-8 pb-8">
        {/* Welcome Header */}
        <div className="mb-8 flex flex-row items-end justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              Welcome back, {user.name}
            </h2>
            <p className="text-sm text-slate-500 mt-1 leading-tight">
              Workspace overview for {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setTopUpOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <Coins className="w-4 h-4" />
              Buy Tokens
            </button>
            <button
              onClick={() => navigate('/calls')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-extrabold shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Phone className="w-5 h-5" />
              New Outbound
            </button>
          </div>
        </div>

        {/* Top Row: Hero Card + Stats */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Hero Wallet Card */}
          <div className="col-span-1 relative overflow-hidden hero-card rounded-2xl shadow-[0_8px_25px_rgba(15,23,42,0.15)] p-6 flex flex-col gap-5">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/30 rounded-full blur-3xl z-0" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl z-0" />

            <div className="relative z-10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Credits</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold text-white tracking-tight">
                  {balanceLoading || balance === null ? '...' : formatTokens(balance.tokens)}
                </span>
                <span className="text-sm font-bold text-slate-400">tokens</span>
              </div>
            </div>

            <div className="relative z-10 flex gap-3">
              <button
                onClick={() => setBuyNumberOpen(true)}
                className="flex-1 h-11 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(99,102,241,0.3)] active:scale-95 transition-all"
              >
                <Phone className="w-4 h-4" /> Buy Number
              </button>
              <button
                onClick={() => setTopUpOpen(true)}
                className="h-11 px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 backdrop-blur-sm active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" /> Top Up
              </button>
            </div>

            <div className="relative z-10 flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Auto-recharge at 2,000 tokens</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="col-span-2 grid grid-cols-3 gap-4">
            <div className="premium-card rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Active</span>
                <h3 className="text-3xl font-extrabold text-indigo-600 mt-2 leading-none">{activeNumbers}</h3>
              </div>
              <span className="text-sm font-bold text-slate-500 mt-3">Phone Numbers</span>
            </div>
            <div className="premium-card rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Calls</span>
                <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2 leading-none">
                  {callCount}
                </h3>
              </div>
              <span className="text-sm font-bold text-slate-400 mt-3 inline-flex items-center gap-1 w-fit">
                Total
              </span>
            </div>
            <div className="premium-card rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">SMS</span>
                <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2 leading-none">
                  {smsCount}
                </h3>
              </div>
              <span className="text-sm font-bold text-slate-400 mt-3">Today</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Analytics + Activity */}
        <div className="grid grid-cols-3 gap-6">
          {/* Consumption Analytics */}
          <div className="col-span-2 premium-card rounded-2xl p-6 flex flex-col gap-6 h-[400px]">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Consumption</h4>
                <p className="text-sm text-slate-500 mt-0.5">Usage volume across all services this week</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <button className="px-4 py-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  Week
                </button>
                <button className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold">
                  Month
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-end justify-between gap-4 pt-4 px-4">
              {trend.counts.map((count, i) => {
                const height = `${(count / trend.max) * 100}%`;
                const bgClass =
                  count > 70 ? 'bg-indigo-500' : count > 40 ? 'bg-indigo-400' : 'bg-indigo-200';
                return (
                  <div key={i} className="flex flex-col items-center gap-3 flex-1 h-full justify-end">
                    <div
                      className={cn('w-full rounded-t-lg transition-all hover:bg-indigo-600', bgClass)}
                      style={{ height }}
                    />
                    <span className="text-xs font-bold text-slate-400">{trend.days[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="col-span-1 premium-card rounded-2xl p-6 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Recent Activity</h4>
              <button
                onClick={() => navigate('/messages')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {activity.map((item) => {
                let Icon = Phone;
                let bgClass = 'bg-indigo-50 text-indigo-600';
                if (item.type === 'incoming') { Icon = PhoneIncoming; bgClass = 'bg-indigo-50 text-indigo-600'; }
                if (item.type === 'missed') { Icon = PhoneMissed; bgClass = 'bg-rose-50 text-rose-600'; }
                if (item.type === 'message') { Icon = MessageSquare; bgClass = 'bg-indigo-50 text-indigo-600'; }
                if (item.type === 'outgoing') { Icon = PhoneOutgoing; bgClass = 'bg-emerald-50 text-emerald-600'; }
                if (item.type === 'topup') { Icon = Wallet; bgClass = 'bg-emerald-50 text-emerald-600'; }

                return (
                  <div key={item.id} className="rounded-xl overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => handleActivityClick(item)}
                    >
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', bgClass)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                      </div>
                      <p className="text-xs text-slate-400 shrink-0 font-bold">{item.time}</p>
                    </div>
                    {expandedActivityId === item.id && isCallType(item.type) && (
                      <div className="px-3 pb-3 pt-1 flex gap-2 animate-fade-in">
                        <button
                          onClick={() => handleActivityCall(item.title)}
                          className="flex-1 h-9 rounded-[10px] bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call
                        </button>
                        <button
                          onClick={() => handleActivityMessage(item.title)}
                          className="flex-1 h-9 rounded-[10px] bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform dark:bg-indigo-900/30 dark:text-indigo-400"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Message
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Your Numbers Section */}
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Your Numbers</h3>
            <button
              onClick={() => navigate('/numbers')}
              className="text-sm font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Manage All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {phoneNumbers.slice(0, 4).map((num) => {
              const countdown = getCountdown(num.next_billing_date);
              const isExpiringSoon = countdown && !countdown.expired && countdown.days <= 3;
              const isExpired = countdown?.expired;
              const showWarning = isExpiringSoon || isExpired;
              return (
              <div
                key={num.id}
                className="premium-card rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-xl">{num.flag || '📞'}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          {num.number}
                        </h4>
                        <span className={cn('w-2 h-2 rounded-full shrink-0', num.active ? 'bg-emerald-500' : 'bg-slate-300')} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 truncate">
                        {num.label || 'Phone Number'} • {num.features.join(', ') || 'SMS/Voice'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <button className="w-9 h-9 rounded-full bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors dark:bg-slate-800 dark:text-slate-400">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button className="w-9 h-9 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors dark:bg-slate-800 dark:text-slate-400">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {showWarning && (
                  <div className={cn(
                    'rounded-xl px-3 py-2.5 flex items-center justify-between gap-2',
                    isExpired ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className={cn('w-4 h-4 shrink-0', isExpired ? 'text-red-500' : 'text-amber-500')} />
                      <span className={cn('text-xs font-bold leading-tight', isExpired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                        {isExpired
                          ? 'Number expired — deposit now to restore'
                          : `Renewal in ${formatCountdown(countdown!)} — deposit to keep your number`}
                      </span>
                    </div>
                    <button
                      onClick={() => setTopUpOpen(true)}
                      className={cn(
                        'shrink-0 h-8 px-3 rounded-[10px] text-xs font-extrabold text-white active:scale-95 transition-transform flex items-center gap-1.5',
                        isExpired ? 'bg-red-500' : 'bg-amber-500'
                      )}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Deposit Now
                    </button>
                  </div>
                )}
              </div>
              );
            })}

            {phoneNumbers.length === 0 && (
              <div className="col-span-2 premium-card rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <Phone className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-500">No phone numbers yet</p>
                <button
                  onClick={() => setBuyNumberOpen(true)}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-extrabold hover:bg-indigo-500 transition-colors"
                >
                  Buy your first number
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* TOP-UP MODAL (Korapay Token Purchase)      */}
      {/* ========================================= */}
      {topUpOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70]"
            onClick={() => !paying && setTopUpOpen(false)}
          />
          <div className="fixed z-[71] flex flex-col bg-white dark:bg-slate-900 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] lg:shadow-[0_20px_60px_rgba(0,0,0,0.15)] pb-8 pt-2 max-w-md mx-auto left-0 right-0 bottom-0 rounded-t-[28px] lg:top-1/2 lg:left-1/2 lg:right-auto lg:bottom-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[28px] lg:w-[440px]">
            <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />

            <div className="px-5 flex flex-col gap-4">
              <div className="text-center relative">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Buy Tokens</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Current balance:{' '}
                  <span className="font-bold text-indigo-600">
                    {balanceLoading || balance === null ? '...' : `${formatTokens(balance.tokens)} tokens`}
                  </span>
                </p>
                <button
                  onClick={() => !paying && setTopUpOpen(false)}
                  className="absolute -top-1 right-0 w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform dark:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Token Package Selection */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {TOKEN_PACKAGES.map((pkg, index) => (
                  <button
                    key={pkg.tokens}
                    onClick={() => setSelectedPackage(index)}
                    className={cn(
                      'rounded-[14px] p-3 flex flex-col items-center gap-1 transition-all active:scale-95 border',
                      selectedPackage === index
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                        : 'bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    )}
                  >
                    <Coins className={cn('w-5 h-5', selectedPackage === index ? 'text-white' : 'text-indigo-500')} />
                    <span className="text-sm font-extrabold">{formatTokens(pkg.tokens)}</span>
                    <span className={cn('text-[10px] font-bold', selectedPackage === index ? 'text-indigo-100' : 'text-slate-400')}>
                      {formatCurrency(pkg.priceMinor, pkg.currency)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Payment Method */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[14px] mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-900 rounded-[8px] flex items-center justify-center text-white shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Korapay</span>
                    <span className="text-xs text-slate-500 font-medium">Secure Checkout</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-[6px] uppercase tracking-widest border border-emerald-100">Active</span>
              </div>

              {/* Error Display */}
              {payError && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-100 rounded-[12px] p-2.5 dark:bg-red-900/20 dark:border-red-800">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {payError}
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={paying}
                className={cn(
                  'w-full h-12 mt-2 rounded-[16px] text-sm font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.2)]',
                  paying ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white dark:bg-indigo-600'
                )}
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Pay {formatCurrency(TOKEN_PACKAGES[selectedPackage].priceMinor, TOKEN_PACKAGES[selectedPackage].currency)}
                  </>
                )}
              </button>

              <button
                onClick={() => !paying && setTopUpOpen(false)}
                className="w-full flex items-center justify-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        </>
      )}
      <BuyNumberModal open={buyNumberOpen} onClose={() => setBuyNumberOpen(false)} />
    </div>
  );
}

export default memo(Dashboard);
