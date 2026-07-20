import { useState, useEffect, useCallback, memo } from 'react';
import {
  Search,
  Filter,
  Phone,
  MessageSquare,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  PhoneForwarded,
  Voicemail,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { BuyNumberModal } from '../components/BuyNumberModal';
import { fetchUserPhoneNumbers, togglePhoneNumberActive, type PhoneNumberRecord } from '../lib/phoneNumbers';

interface NumberItem {
  id: string;
  number: string;
  label: string;
  flag: string;
  features: ('voice' | 'sms' | 'mms')[];
  active: boolean;
  forwarding?: string | null;
  voicemail?: boolean;
  monthlyCost: number;
}

function mapRecordToItem(r: PhoneNumberRecord): NumberItem {
  return {
    id: r.id,
    number: r.number,
    label: r.label,
    flag: r.flag,
    features: (r.features || []).filter((f): f is 'voice' | 'sms' | 'mms' =>
      f === 'voice' || f === 'sms' || f === 'mms'
    ),
    active: r.active,
    forwarding: r.forwarding,
    voicemail: r.voicemail,
    monthlyCost: r.monthly_cost,
  };
}


function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-block w-8 h-5 rounded-full transition-colors duration-300 shrink-0',
        checked ? 'bg-indigo-600' : 'bg-slate-300'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white border-4 shadow-sm transition-all duration-300',
          checked ? 'translate-x-3 border-indigo-600' : 'border-slate-300'
        )}
      />
    </button>
  );
}

function FeatureBadge({ icon: Icon, label, color }: { icon: React.ComponentType<{ className?: string }>; label: string; color: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-[6px] text-[9px] font-extrabold border uppercase tracking-wide flex items-center gap-1', color)}>
      <Icon className="w-2.5 h-2.5" /> {label}
    </span>
  );
}

export function PhoneNumbers() {
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyModalOpen, setBuyModalOpen] = useState(false);

  const loadNumbers = useCallback(async () => {
    setLoading(true);
    const records = await fetchUserPhoneNumbers();
    setNumbers(records.map(mapRecordToItem));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNumbers();
  }, [loadNumbers]);

  const totalMonthly = numbers.reduce((sum, n) => sum + n.monthlyCost, 0);

  const toggleActive = async (id: string) => {
    const item = numbers.find((n) => n.id === id);
    if (!item) return;
    const newActive = !item.active;
    setNumbers((prev) => prev.map((n) => (n.id === id ? { ...n, active: newActive } : n)));
    const success = await togglePhoneNumberActive(id, newActive);
    if (!success) {
      setNumbers((prev) => prev.map((n) => (n.id === id ? { ...n, active: !newActive } : n)));
    }
  };

  const featureBadgeConfig = {
    voice: { icon: Phone, label: 'Voice', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    sms: { icon: MessageSquare, label: 'SMS', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    mms: { icon: ImageIcon, label: 'MMS', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F0F4F8] dark:bg-slate-950">
      {/* ========================================= */}
      {/* MOBILE LAYOUT (hidden on lg+)             */}
      {/* ========================================= */}
      <div className="lg:hidden px-4 pt-3 pb-[10px] flex flex-col gap-3.5">
        {/* Hero Summary Card */}
        <div className="animate-fade-in shrink-0 relative overflow-hidden hero-card rounded-[20px] shadow-[0_8px_25px_rgba(15,23,42,0.15)] p-4 flex flex-col gap-4">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl z-0" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl z-0" />
          <div className="relative z-10 flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Active Lines</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-extrabold text-white tracking-tight leading-none">{numbers.length}</span>
                <span className="text-[11px] font-bold text-white/90">Numbers</span>
              </div>
            </div>
            <div className="text-right flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Monthly Cost</span>
              <span className="text-[14px] font-extrabold text-white">${totalMonthly.toFixed(2)}</span>
            </div>
          </div>
          <div className="relative z-10">
            <button
              onClick={() => setBuyModalOpen(true)}
              className="w-full h-11 bg-white text-indigo-600 hover:bg-slate-50 rounded-[14px] text-[13px] font-extrabold flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-95 transition-transform"
            >
              <ShoppingCart className="w-4 h-4" /> Get New Number
            </button>
          </div>
        </div>

        {/* Active Numbers List */}
        <div className="animate-fade-in animate-delay-100 shrink-0 flex flex-col gap-2.5 mt-1">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">Your Portfolio</h3>
            <button className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : numbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-800">
                  <Phone className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No numbers yet</p>
                <p className="text-xs text-slate-500 mt-1">Tap "Get New Number" to purchase your first virtual number.</p>
              </div>
            ) : numbers.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 flex flex-col gap-3 dark:bg-slate-900 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 text-[18px] flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-600">
                      {n.flag}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="text-[15px] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{n.number}</h4>
                      <span className="text-[10px] font-bold text-slate-500">{n.label}</span>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95 dark:bg-slate-800 dark:text-slate-400">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-1.5 overflow-hidden">
                  {n.features.map((f) => {
                    const cfg = featureBadgeConfig[f];
                    return <FeatureBadge key={f} icon={cfg.icon} label={cfg.label} color={cfg.color} />;
                  })}
                </div>

                <div className="pt-3 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Toggle checked={n.active} onChange={() => toggleActive(n.id)} />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{n.active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {n.forwarding ? (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-[8px] border border-slate-100 flex items-center gap-1 dark:bg-slate-800 dark:border-slate-700">
                      <PhoneForwarded className="w-3 h-3" /> Fwd: {n.forwarding}
                    </span>
                  ) : n.voicemail ? (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-[8px] border border-slate-100 flex items-center gap-1 dark:bg-slate-800 dark:border-slate-700">
                      <Voicemail className="w-3 h-3" /> Send to Voicemail
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BuyNumberModal open={buyModalOpen} onClose={() => setBuyModalOpen(false)} onPurchased={loadNumbers} />

      {/* ========================================= */}
      {/* DESKTOP LAYOUT (hidden below lg)          */}
      {/* ========================================= */}
      <div className="hidden lg:block p-8 pb-8">
        {/* Header */}
        <div className="mb-8 flex flex-row items-end justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Phone Numbers</h2>
            <p className="text-sm text-slate-500 mt-1 leading-tight">Manage your virtual numbers across all regions.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search number or label..."
                className="h-11 w-64 bg-white border border-slate-200 rounded-xl pl-10 pr-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <Filter className="w-4 h-4" /> All Countries
            </button>
            <button
              onClick={() => setBuyModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-extrabold shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Get New Number
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="premium-card rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Active Lines</span>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none mt-1">{numbers.filter((n) => n.active).length}</h3>
            </div>
          </div>
          <div className="premium-card rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Total Numbers</span>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none mt-1">{numbers.length}</h3>
            </div>
          </div>
          <div className="premium-card rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Monthly Cost</span>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none mt-1">${totalMonthly.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        {/* Numbers Grid */}
        <div className="grid grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 dark:bg-slate-800">
                <Phone className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">No phone numbers yet</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">Click "Get New Number" to purchase your first virtual phone number and start making calls and sending messages.</p>
            </div>
          ) : numbers.map((n) => (
            <div key={n.id} className="premium-card rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-50 text-[22px] flex items-center justify-center shrink-0 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-600">
                    {n.flag}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{n.number}</h4>
                    <span className="text-xs font-bold text-slate-500">{n.label}</span>
                  </div>
                </div>
                <button className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors dark:bg-slate-800 dark:text-slate-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2">
                {n.features.map((f) => {
                  const cfg = featureBadgeConfig[f];
                  return <FeatureBadge key={f} icon={cfg.icon} label={cfg.label} color={cfg.color} />;
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Toggle checked={n.active} onChange={() => toggleActive(n.id)} />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{n.active ? 'Active' : 'Inactive'}</span>
                </div>
                {n.forwarding ? (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center gap-1.5 dark:bg-slate-800 dark:border-slate-700">
                    <PhoneForwarded className="w-3.5 h-3.5" /> Fwd: {n.forwarding}
                  </span>
                ) : n.voicemail ? (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center gap-1.5 dark:bg-slate-800 dark:border-slate-700">
                    <Voicemail className="w-3.5 h-3.5" /> Send to Voicemail
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default memo(PhoneNumbers);
