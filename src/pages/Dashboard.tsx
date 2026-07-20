import { useMemo, memo, useState } from 'react';
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
  CheckCircle,
  Wallet,
  TrendingUp,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { formatTokens } from '../lib/balance';
import { cn } from '../lib/utils';
import { BuyNumberModal } from '../components/BuyNumberModal';

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildTrend() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const counts = days.map(() => Math.floor(Math.random() * 80) + 20); // mock data
  const max = 100;
  return { days, counts, max };
}

export function Dashboard() {
  const messages = useAppStore((s) => s.messages);
  const conversations = useAppStore((s) => s.conversations);
  const user = useAppStore((s) => s.user);
  const balance = useAppStore((s) => s.balance);
  const balanceLoading = useAppStore((s) => s.balanceLoading);
  const navigate = useNavigate();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [buyNumberOpen, setBuyNumberOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [paying, setPaying] = useState(false);

  const trend = useMemo(() => buildTrend(), []);

  const activity = useMemo(() => {
    if (messages.length === 0) {
      return [
        { id: '1', title: 'Received SMS', description: 'From +1 (555) 987-6543', time: 'Just now', type: 'message' },
        { id: '2', title: 'Wallet Top Up', description: '$50.00 added successfully', time: '2h ago', type: 'topup' },
        { id: '3', title: '+1 (555) 234-5678', description: 'In • 2m 45s', time: '10:42', type: 'incoming' },
        { id: '4', title: 'Unknown Caller', description: 'Missed', time: '09:15', type: 'missed' },
        { id: '5', title: '+44 20 7946 0958', description: 'Out • 14m 12s', time: '1d', type: 'outgoing' },
      ];
    }
    return messages.slice(0, 6).map((m, i) => {
      const isInbound = m.direction === 'inbound';
      const isSms = m.type === 'text';
      let type = isSms ? 'message' : isInbound ? 'incoming' : 'outgoing';
      let description = '';
      if (isSms) description = `"${m.body.substring(0, 25)}..."`;
      else if (type === 'incoming') description = 'In • 2m 45s';
      else description = 'Out • 14m 12s';

      if (i === 2 && !isSms) {
        type = 'missed';
        description = 'Missed';
      }

      return {
        id: m.id,
        title: isInbound ? m.from || m.conversationId : m.to || m.conversationId,
        description,
        time: formatTime(m.createdAt),
        type,
      };
    });
  }, [messages]);

  const activeNumbers = Math.max(1, conversations.length);
  const callCount = activity.filter((a) => a.type === 'incoming' || a.type === 'outgoing').length;
  const smsCount = activity.filter((a) => a.type === 'message').length;

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setTopUpOpen(false);
    }, 1500);
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
              <PlusCircle className="w-3.5 h-3.5" /> Top Up
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
            <span className="text-[8.5px] font-bold text-emerald-500 bg-emerald-50 px-1 rounded mt-1">+12%</span>
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
            {conversations.slice(0, 2).map((conv) => (
              <div
                key={conv.id}
                className="bg-white border border-slate-200/80 rounded-[16px] shadow-[0_2px_10px_rgba(15,23,42,0.02)] p-2.5 flex items-center justify-between active:bg-slate-50 transition-colors dark:bg-slate-900 dark:border-slate-700/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-[18px] flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    {conv.avatar.startsWith('http') ? (
                      <img src={conv.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span>{conv.avatar}</span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {conv.contact}
                      </h4>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 truncate">
                      {conv.lastMessage?.body?.substring(0, 30) || 'No messages'}
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
            ))}

            {conversations.length === 0 && (
              <>
                <div className="bg-white border border-slate-200/80 rounded-[16px] shadow-[0_2px_10px_rgba(15,23,42,0.02)] p-2.5 flex items-center justify-between active:bg-slate-50 transition-colors dark:bg-slate-900 dark:border-slate-700/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-[18px] flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">🇺🇸</div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 truncate">+1 (555) 019-2834</h4>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 truncate">Sales Main Line • SMS/Voice</span>
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

                <div className="bg-white border border-slate-200/80 rounded-[16px] shadow-[0_2px_10px_rgba(15,23,42,0.02)] p-2.5 flex items-center justify-between active:bg-slate-50 transition-colors dark:bg-slate-900 dark:border-slate-700/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-[18px] flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">🇬🇧</div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 truncate">+44 20 7946 0958</h4>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 truncate">UK Support • Voice Only</span>
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
              </>
            )}
          </div>
        </div>

        {/* 4. Recent Activity */}
        <div className="animate-fade-in animate-delay-300 shrink-0 flex flex-col gap-2.5 mt-2">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">Recent Activity</h3>
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
                <div
                  key={item.id}
                  className="p-2 flex items-center justify-between active:bg-slate-50 rounded-[14px] transition-colors cursor-pointer dark:hover:bg-slate-800"
                  onClick={() => navigate('/messages')}
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
              <Wallet className="w-4 h-4" />
              Top Up
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
              <span className="text-sm font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded mt-3 inline-flex items-center gap-1 w-fit">
                <TrendingUp className="w-3 h-3" /> +12%
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
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    onClick={() => navigate('/messages')}
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
            {conversations.slice(0, 4).map((conv) => (
              <div
                key={conv.id}
                className="premium-card rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    {conv.avatar.startsWith('http') ? (
                      <img src={conv.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-600 dark:text-slate-300">{conv.avatar}</span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {conv.contact}
                      </h4>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 truncate">
                      {conv.lastMessage?.body?.substring(0, 40) || 'No messages'}
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
            ))}

            {conversations.length === 0 && (
              <>
                <div className="premium-card rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-xl flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                      🇺🇸
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          +1 (555) 019-2834
                        </h4>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 truncate">Sales Main Line • SMS/Voice</span>
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

                <div className="premium-card rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-xl flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                      🇬🇧
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          +44 20 7946 0958
                        </h4>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 truncate">UK Support • Voice Only</span>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* TOP-UP MODAL                               */}
      {/* ========================================= */}
      {topUpOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70]"
            onClick={() => setTopUpOpen(false)}
          />
          <div className="fixed left-0 right-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[28px] z-[71] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col pb-8 pt-2 max-w-md mx-auto">
            <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />

            <div className="px-5 flex flex-col gap-4">
              <div className="text-center">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Add Wallet Balance</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Current balance:{' '}
                  <span className="font-bold text-indigo-600">
                    {balanceLoading || balance === null ? '...' : `${formatTokens(balance.tokens)} tokens`}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2">
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedAmount(amt)}
                    className={cn(
                      'h-12 rounded-[14px] text-base font-extrabold transition-all active:scale-95',
                      selectedAmount === amt
                        ? 'bg-indigo-600 text-white border border-indigo-600 shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                        : 'bg-white border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    )}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                <input
                  type="number"
                  placeholder="Other amount"
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[14px] pl-8 pr-4 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[14px] mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-[8px] flex items-center justify-center text-white">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Default Method</span>
                    <span className="text-xs text-slate-500 font-medium">Token purchase</span>
                  </div>
                </div>
                <span className="text-sm text-slate-400 font-bold">Change</span>
              </div>

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
                    <CheckCircle className="w-5 h-5" /> Processing...
                  </>
                ) : (
                  `Pay $${selectedAmount}`
                )}
              </button>

              <button
                onClick={() => setTopUpOpen(false)}
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
