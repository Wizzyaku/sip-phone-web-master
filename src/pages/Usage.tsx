import { useMemo, memo } from 'react';
import {
  Phone,
  MessageSquare,
  Clock,
  Coins,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Globe,
  MoreVertical,
} from 'lucide-react';
import { cn } from '../lib/utils';

const kpiData = [
  {
    label: 'Call Minutes',
    value: '14,282',
    change: '+12%',
    trend: 'up' as const,
    icon: Phone,
    iconBg: 'bg-indigo-50 text-indigo-600',
  },
  {
    label: 'SMS Sent',
    value: '8,419',
    change: '+4.5%',
    trend: 'up' as const,
    icon: MessageSquare,
    iconBg: 'bg-purple-50 text-purple-600',
  },
  {
    label: 'Avg Duration',
    value: '4m 12s',
    change: '-2.1%',
    trend: 'down' as const,
    icon: Clock,
    iconBg: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'Tokens Used',
    value: '38.1k',
    change: 'Target: 50k',
    trend: 'neutral' as const,
    icon: Coins,
    iconBg: 'bg-slate-100 text-slate-600',
    progress: 76,
  },
];

const topContacts = [
  {
    id: '1',
    initials: 'JD',
    color: 'bg-indigo-50 text-indigo-600',
    name: 'Jordan Davids',
    volume: '1,242 Calls • N. America',
    duration: '42h 15m',
    trend: '+18%',
    trendUp: true,
  },
  {
    id: '2',
    initials: 'AM',
    color: 'bg-purple-50 text-purple-600',
    name: 'Aria Martinez',
    volume: '892 Calls • Europe',
    duration: '28h 05m',
    trend: '+12%',
    trendUp: true,
  },
  {
    id: '3',
    initials: 'LK',
    color: 'bg-amber-50 text-amber-600',
    name: 'Lian Kim',
    volume: '754 Calls • APAC',
    duration: '19h 42m',
    trend: '-4%',
    trendUp: false,
  },
];

const geographicData = [
  { region: 'United States', percent: 42 },
  { region: 'United Kingdom', percent: 28 },
  { region: 'Canada', percent: 15 },
  { region: 'Australia', percent: 10 },
];

const tokenBreakdown = [
  { label: 'Voice Calls', percent: 65, color: 'bg-indigo-500' },
  { label: 'SMS Volume', percent: 25, color: 'bg-purple-500' },
  { label: 'Sub/Other', percent: 10, color: 'bg-slate-200' },
];

function getHeatmapClass(value: number) {
  if (value > 85) return 'bg-indigo-600';
  if (value > 60) return 'bg-indigo-400';
  if (value > 30) return 'bg-indigo-200';
  return 'bg-indigo-50';
}

export function Usage() {
  const heatmapData = useMemo(() => {
    const rows = 7;
    const cols = 24;
    const data: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(Math.floor(Math.random() * 100));
      }
      data.push(row);
    }
    return data;
  }, []);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F0F4F8] dark:bg-slate-950">
      {/* ========================================= */}
      {/* MOBILE LAYOUT (hidden on lg+)             */}
      {/* ========================================= */}
      <div className="lg:hidden px-4 pt-3 pb-[10px] flex flex-col gap-3.5">
        {/* Title & Date Filter */}
        <div className="animate-fade-in shrink-0 flex justify-between items-end mb-1">
          <div>
            <h2 className="text-[20px] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none">Usage Stats</h2>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Performance & token spend</p>
          </div>
          <button className="h-8 px-3 bg-white border border-slate-200 text-slate-700 rounded-[10px] text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            <CalendarDays className="w-3.5 h-3.5" /> 30 Days
          </button>
        </div>

        {/* 1. KPI 2x2 Grid */}
        <div className="shrink-0 animate-fade-in animate-delay-100 grid grid-cols-2 gap-2.5">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white border border-slate-200/80 rounded-[18px] p-3 shadow-[0_2px_10px_rgba(15,23,42,0.02)] dark:bg-slate-900 dark:border-slate-700/50">
                <div className="flex justify-between items-start mb-1.5">
                  <div className={cn('w-7 h-7 rounded-[8px] flex items-center justify-center', kpi.iconBg)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {kpi.trend === 'up' && (
                    <span className="text-[9px] font-extrabold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingUp className="w-2.5 h-2.5" /> {kpi.change}
                    </span>
                  )}
                  {kpi.trend === 'down' && (
                    <span className="text-[9px] font-extrabold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingDown className="w-2.5 h-2.5" /> {kpi.change}
                    </span>
                  )}
                  {kpi.trend === 'neutral' && (
                    <span className="text-[8.5px] font-bold text-slate-400 px-1 py-0.5">{kpi.change}</span>
                  )}
                </div>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide mt-2">{kpi.label}</p>
                {kpi.progress ? (
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[16px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight">{kpi.value}</h3>
                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${kpi.progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <h3 className="text-[16px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight">{kpi.value}</h3>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. Main Chart */}
        <div className="shrink-0 animate-fade-in animate-delay-200 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 dark:bg-slate-900 dark:border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Consumption Trend</h4>
            <div className="flex gap-2">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Calls</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">SMS</span>
              </div>
            </div>
          </div>
          <div className="h-[140px] relative w-full chart-grid rounded-xl border border-slate-100 overflow-hidden bg-slate-50/30 dark:border-slate-700 dark:bg-slate-800/30">
            <div className="absolute bottom-0 left-0 w-full h-full p-2 flex items-end">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,80 Q10,75 20,85 T40,60 T60,70 T80,40 T100,50 L100,100 L0,100 Z" fill="rgba(79, 70, 229, 0.1)" />
                <path d="M0,80 Q10,75 20,85 T40,60 T60,70 T80,40 T100,50" fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d="M0,90 Q10,88 20,92 T40,85 T60,88 T80,82 T100,85" fill="none" stroke="#a855f7" strokeDasharray="4 4" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="absolute inset-x-3 bottom-1.5 flex justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">
              <span>W1</span><span>W2</span><span>W3</span><span>W4</span>
            </div>
          </div>
        </div>

        {/* 3. Token Breakdown */}
        <div className="shrink-0 animate-fade-in animate-delay-300 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 dark:bg-slate-900 dark:border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Usage Breakdown</h4>
            <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">38k <span className="text-[9px] text-slate-400 font-bold">Total</span></span>
          </div>
          <div className="w-full h-3 flex rounded-full overflow-hidden mb-3">
            <div className="w-[65%] bg-indigo-500" />
            <div className="w-[25%] bg-purple-500" />
            <div className="w-[10%] bg-slate-200" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tokenBreakdown.map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', item.color)} />
                  <span className="text-[9px] font-bold text-slate-500">{item.label}</span>
                </div>
                <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100 pl-3.5">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Heatmap */}
        <div className="shrink-0 animate-fade-in animate-delay-400 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 dark:bg-slate-900 dark:border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Activity Heatmap</h4>
            <span className="text-[9px] font-bold text-slate-400">UTC -5</span>
          </div>
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[340px]">
              <div className="grid gap-[2px] h-24 mb-1.5" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                {heatmapData.flat().map((value, i) => (
                  <div key={i} className={cn('w-full h-full rounded-[1px]', getHeatmapClass(value))} />
                ))}
              </div>
              <div className="flex justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-widest px-0.5">
                <span>12A</span><span>6A</span><span>12P</span><span>6P</span><span>11P</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Top Contacts */}
        <div className="shrink-0 animate-fade-in animate-delay-500 flex flex-col gap-2">
          <div className="flex justify-between items-end px-1 mt-1">
            <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Top Drivers</h4>
            <button className="text-[10px] font-extrabold text-indigo-600">View All</button>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-2 flex flex-col divide-y divide-slate-100 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700">
            {topContacts.map((contact) => (
              <div key={contact.id} className="p-2 flex items-center justify-between active:bg-slate-50 rounded-xl transition-colors dark:hover:bg-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0', contact.color)}>
                    {contact.initials}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100">{contact.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{contact.volume}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('text-[9px] font-extrabold px-1.5 py-0.5 rounded', contact.trendUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50')}>
                    {contact.trend}
                  </span>
                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100">{contact.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* DESKTOP LAYOUT (hidden below lg)          */}
      {/* ========================================= */}
      <div className="hidden lg:block p-8 pb-8">
        {/* Header */}
        <div className="mb-8 flex flex-row items-end justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Usage Analytics</h2>
            <p className="text-sm text-slate-500 mt-1 leading-tight">Monitor your global communication performance and token spend.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <CalendarDays className="w-4 h-4" /> Last 30 Days
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-extrabold shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:bg-indigo-500 active:scale-95 transition-all">
              <Globe className="w-4 h-4" /> Export Report
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="premium-card rounded-2xl p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', kpi.iconBg)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {kpi.trend === 'up' && (
                    <span className="text-xs font-extrabold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {kpi.change}
                    </span>
                  )}
                  {kpi.trend === 'down' && (
                    <span className="text-xs font-extrabold text-rose-500 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> {kpi.change}
                    </span>
                  )}
                  {kpi.trend === 'neutral' && (
                    <span className="text-xs font-bold text-slate-400 px-1 py-0.5">{kpi.change}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                  {kpi.progress ? (
                    <div className="flex items-baseline justify-between mt-1">
                      <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{kpi.value}</h3>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${kpi.progress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 leading-none mt-1">{kpi.value}</h3>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Grid: Chart + Breakdown */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Consumption Chart */}
          <div className="col-span-2 premium-card rounded-2xl p-6 flex flex-col gap-6 h-[380px]">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Consumption Trend</h4>
                <p className="text-sm text-slate-500 mt-0.5">Usage volume across all services this month</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span className="text-xs font-bold text-slate-500">Calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-xs font-bold text-slate-500">SMS</span>
                </div>
              </div>
            </div>
            <div className="flex-1 relative w-full chart-grid rounded-xl border border-slate-100 overflow-hidden bg-slate-50/30 dark:border-slate-700 dark:bg-slate-800/30">
              <div className="absolute bottom-0 left-0 w-full h-full p-4 flex items-end">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <path d="M0,80 Q10,75 20,85 T40,60 T60,70 T80,40 T100,50 L100,100 L0,100 Z" fill="rgba(79, 70, 229, 0.1)" />
                  <path d="M0,80 Q10,75 20,85 T40,60 T60,70 T80,40 T100,50" fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path d="M0,90 Q10,88 20,92 T40,85 T60,88 T80,82 T100,85" fill="none" stroke="#a855f7" strokeDasharray="4 4" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="absolute inset-x-6 bottom-3 flex justify-between text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                <span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span>
              </div>
            </div>
          </div>

          {/* Token Breakdown */}
          <div className="col-span-1 premium-card rounded-2xl p-6 flex flex-col h-[380px]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Usage Breakdown</h4>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">38k <span className="text-xs text-slate-400 font-bold">Total</span></span>
            </div>
            <div className="w-full h-4 flex rounded-full overflow-hidden mb-6">
              <div className="w-[65%] bg-indigo-500" />
              <div className="w-[25%] bg-purple-500" />
              <div className="w-[10%] bg-slate-200" />
            </div>
            <div className="flex flex-col gap-4 flex-1 justify-center">
              {tokenBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-3 h-3 rounded-full', item.color)} />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{item.percent}%</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs font-bold uppercase text-slate-400">Intensity</span>
              <div className="flex gap-1">
                <div className="h-4 w-4 rounded bg-indigo-50" />
                <div className="h-4 w-4 rounded bg-indigo-200" />
                <div className="h-4 w-4 rounded bg-indigo-400" />
                <div className="h-4 w-4 rounded bg-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Lower Grid: Heatmap + Geography */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Heatmap */}
          <div className="premium-card rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Activity Heatmap</h4>
              <span className="text-xs font-bold text-slate-400">Timezone: UTC -5</span>
            </div>
            <div className="w-full overflow-x-auto no-scrollbar pb-2">
              <div className="min-w-[480px]">
                <div className="grid gap-[3px] h-32 mb-2" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                  {heatmapData.flat().map((value, i) => (
                    <div key={i} className={cn('w-full h-full rounded-[2px] transition-transform hover:scale-125 cursor-pointer', getHeatmapClass(value))} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-0.5">
                  <span>12 AM</span><span>4 AM</span><span>8 AM</span><span>12 PM</span><span>4 PM</span><span>8 PM</span><span>11 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Geographic Distribution */}
          <div className="premium-card rounded-2xl p-6 flex flex-col">
            <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-4">Geographic Distribution</h4>
            <div className="grid grid-cols-2 gap-6 flex-1">
              <div className="relative rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-slate-800">
                <Globe className="h-16 w-16 text-indigo-400/40" />
              </div>
              <div className="flex flex-col justify-center gap-4">
                {geographicData.map((item) => (
                  <div key={item.region} className="space-y-1.5">
                    <div className="flex justify-between text-sm font-bold text-slate-600 dark:text-slate-300">
                      <span>{item.region}</span>
                      <span className="text-slate-800 dark:text-slate-100">{item.percent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Contacts Table */}
        <div className="premium-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 p-6">
            <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Top Contacts</h4>
            <button className="text-sm font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors">View All Contacts</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Region</th>
                  <th className="px-6 py-4">Volume</th>
                  <th className="px-6 py-4">Total Duration</th>
                  <th className="px-6 py-4">Trend</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {topContacts.map((contact) => (
                  <tr key={contact.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm', contact.color)}>
                          {contact.initials}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{contact.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{contact.volume.split('• ')[1]}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{contact.volume.split(' •')[0]}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{contact.duration}</td>
                    <td className="px-6 py-4">
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-extrabold', contact.trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                        {contact.trend}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 transition-colors group-hover:text-indigo-600">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(Usage);
