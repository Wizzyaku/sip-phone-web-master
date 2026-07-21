import { useState, useEffect, useCallback } from 'react';
import { Search, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface AvailableNumber {
  id: string;
  number: string;
  flag: string;
  features: string[];
  price: number;
}

const countryFilters = [
  { label: '🇺🇸 US', code: 'US' },
  { label: '🇬🇧 UK', code: 'GB' },
  { label: '🇨🇦 CA', code: 'CA' },
  { label: '🇦🇺 AU', code: 'AU' },
  { label: '🇩🇪 DE', code: 'DE' },
  { label: '🇫🇷 FR', code: 'FR' },
];

interface BuyNumberModalProps {
  open: boolean;
  onClose: () => void;
  onPurchased?: () => void;
}

export function BuyNumberModal({ open, onClose, onPurchased }: BuyNumberModalProps) {
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setError('You must be signed in to search for numbers.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/search-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          countryCode: countryFilters[activeFilter].code,
          search: searchTerm || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'Failed to fetch available numbers.');
        setAvailableNumbers([]);
      } else {
        setAvailableNumbers(data.numbers || []);
      }
    } catch {
      setError('Network error. Please try again.');
      setAvailableNumbers([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchTerm]);

  useEffect(() => {
    if (open) {
      fetchNumbers();
    }
  }, [open, activeFilter, fetchNumbers]);

  if (!open) return null;

  const selectNumber = (id: string, price: number) => {
    setSelectedNumber(id);
    setSelectedPrice(price);
    setError(null);
  };

  const handlePurchase = async () => {
    if (!selectedNumber) return;
    const opt = availableNumbers.find((n) => n.id === selectedNumber);
    if (!opt) return;

    setPurchasing(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setError('You must be signed in to purchase a number.');
        setPurchasing(false);
        return;
      }

      const response = await fetch('/api/purchase-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phoneNumber: opt.number }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'Failed to purchase number.');
        setPurchasing(false);
        return;
      }

      setSelectedNumber(null);
      setSelectedPrice(null);
      setPurchasing(false);
      onPurchased?.();
      onClose();
    } catch {
      setError('Network error. Please try again.');
      setPurchasing(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleFilterChange = (idx: number) => {
    setActiveFilter(idx);
    setSelectedNumber(null);
    setSelectedPrice(null);
  };

  return (
    <>
      {/* Mobile Modal */}
      <div className="lg:hidden fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-[28px] flex flex-col max-h-[85vh] dark:bg-slate-900">
          <div className="shrink-0 pt-2 pb-3 px-5 border-b border-slate-100 dark:border-slate-700 flex flex-col items-center relative">
            <div className="w-10 h-1.5 bg-slate-200 rounded-full mb-3 dark:bg-slate-700" />
            <h2 className="text-[18px] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Get a New Number</h2>
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 active:scale-95 dark:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="shrink-0 p-4 bg-slate-50/50 flex flex-col gap-3 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="relative w-full shadow-sm">
              <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-4 h-4 my-auto" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search area code or number..."
                className="w-full h-11 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {countryFilters.map((cf, i) => (
                <button
                  key={cf.label}
                  onClick={() => handleFilterChange(i)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-[10px] text-[11px] font-bold whitespace-nowrap transition-all',
                    activeFilter === i
                      ? 'bg-slate-800 text-white shadow-sm dark:bg-indigo-600'
                      : 'bg-white border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  )}
                >
                  {cf.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-grow overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
            <p className="text-[11px] font-bold text-slate-500 mb-1 dark:text-slate-400">Available Numbers in <span className="text-slate-800 dark:text-slate-100">{countryFilters[activeFilter].label}</span></p>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : error && availableNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-500">{error}</p>
                <button onClick={fetchNumbers} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800">Try again</button>
              </div>
            ) : availableNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-xs font-bold text-slate-500">No numbers found. Try a different search or country.</p>
              </div>
            ) : availableNumbers.map((opt) => (
              <div
                key={opt.id}
                onClick={() => selectNumber(opt.id, opt.price)}
                className={cn(
                  'relative p-3 border-2 rounded-[16px] cursor-pointer flex items-center justify-between transition-all active:scale-[0.98]',
                  selectedNumber === opt.id
                    ? 'border-indigo-600 bg-indigo-50/30'
                    : 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-50 text-[16px] flex items-center justify-center shrink-0 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                    {opt.flag}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[14px] font-extrabold text-slate-800 dark:text-slate-100">{opt.number}</h4>
                    <div className="flex gap-1 mt-1">
                      {opt.features.map((f) => (
                        <span key={f} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 rounded dark:bg-slate-700 dark:text-slate-300">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[13px] font-extrabold text-indigo-600">${opt.price.toFixed(2)}<span className="text-[9px] text-slate-400">/mo</span></span>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    selectedNumber === opt.id ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 dark:border-slate-600'
                  )}>
                    {selectedNumber === opt.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="shrink-0 p-4 border-t border-slate-100 bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.03)] dark:bg-slate-900 dark:border-slate-700">
            {error && availableNumbers.length > 0 && (
              <p className="text-[11px] font-bold text-red-500 text-center mb-2">{error}</p>
            )}
            <button
              disabled={!selectedNumber || purchasing}
              onClick={handlePurchase}
              className={cn(
                'w-full h-12 rounded-[16px] text-[14px] font-extrabold flex items-center justify-center transition-all',
                selectedNumber && !purchasing
                  ? 'bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700'
              )}
            >
              {purchasing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : selectedNumber ? `Pay $${selectedPrice?.toFixed(2)}/mo` : 'Select a Number'}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Modal */}
      <div className="hidden lg:flex fixed inset-0 z-[60] items-center justify-center">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-[24px] shadow-2xl flex flex-col w-[600px] max-h-[80vh] dark:bg-slate-900">
          <div className="shrink-0 px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Get a New Number</h2>
            <button onClick={onClose} className="w-9 h-9 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors dark:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="shrink-0 p-5 bg-slate-50/50 flex flex-col gap-3 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="relative w-full shadow-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search area code or number..."
                className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {countryFilters.map((cf, i) => (
                <button
                  key={cf.label}
                  onClick={() => handleFilterChange(i)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all',
                    activeFilter === i
                      ? 'bg-slate-800 text-white shadow-sm dark:bg-indigo-600'
                      : 'bg-white border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  )}
                >
                  {cf.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-grow overflow-y-auto px-5 py-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Available Numbers in <span className="text-slate-800 dark:text-slate-100">{countryFilters[activeFilter].label}</span></p>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : error && availableNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-500">{error}</p>
                <button onClick={fetchNumbers} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800">Try again</button>
              </div>
            ) : availableNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-xs font-bold text-slate-500">No numbers found. Try a different search or country.</p>
              </div>
            ) : availableNumbers.map((opt) => (
              <div
                key={opt.id}
                onClick={() => selectNumber(opt.id, opt.price)}
                className={cn(
                  'relative p-4 border-2 rounded-2xl cursor-pointer flex items-center justify-between transition-all hover:scale-[1.01]',
                  selectedNumber === opt.id
                    ? 'border-indigo-600 bg-indigo-50/30'
                    : 'border-slate-100 bg-white hover:border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 text-[18px] flex items-center justify-center shrink-0 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                    {opt.flag}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{opt.number}</h4>
                    <div className="flex gap-1 mt-1">
                      {opt.features.map((f) => (
                        <span key={f} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded dark:bg-slate-700 dark:text-slate-300">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-extrabold text-indigo-600">${opt.price.toFixed(2)}<span className="text-[10px] text-slate-400">/mo</span></span>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    selectedNumber === opt.id ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 dark:border-slate-600'
                  )}>
                    {selectedNumber === opt.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="shrink-0 p-5 border-t border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-700">
            {error && availableNumbers.length > 0 && (
              <p className="text-xs font-bold text-red-500 text-center mb-2">{error}</p>
            )}
            <button
              disabled={!selectedNumber || purchasing}
              onClick={handlePurchase}
              className={cn(
                'w-full h-12 rounded-2xl text-sm font-extrabold flex items-center justify-center transition-all',
                selectedNumber && !purchasing
                  ? 'bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700'
              )}
            >
              {purchasing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : selectedNumber ? `Pay $${selectedPrice?.toFixed(2)}/mo` : 'Select a Number'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
