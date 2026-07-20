import { useState } from 'react';
import { Search, Check, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { insertPhoneNumber } from '../lib/phoneNumbers';

const availableNumbers = [
  { id: 'a1', number: '+1 (310) 555-0199', flag: '🇺🇸', features: ['Voice', 'SMS'], price: 7.0 },
  { id: 'a2', number: '+1 (212) 555-0844', flag: '🇺🇸', features: ['Voice', 'SMS', 'MMS'], price: 8.5 },
  { id: 'a3', number: '+1 (415) 555-0912', flag: '🇺🇸', features: ['Voice', 'SMS'], price: 7.0 },
  { id: 'a4', number: '+44 20 7946 0712', flag: '🇬🇧', features: ['Voice', 'SMS'], price: 8.0 },
];

const countryFilters = [
  { label: '🇺🇸 US (+1)' },
  { label: '🇬🇧 UK (+44)' },
  { label: '🇨🇦 CA (+1)' },
  { label: 'Toll-Free' },
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

    const featuresLower = opt.features.map((f) => f.toLowerCase());
    const result = await insertPhoneNumber(opt.number, opt.flag, featuresLower, opt.price);

    if (result) {
      setSelectedNumber(null);
      setSelectedPrice(null);
      setPurchasing(false);
      onPurchased?.();
      onClose();
    } else {
      setError('Failed to purchase number. Please try again.');
      setPurchasing(false);
    }
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
                placeholder="Search Country, Area Code or Number..."
                className="w-full h-11 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {countryFilters.map((cf, i) => (
                <button
                  key={cf.label}
                  onClick={() => setActiveFilter(i)}
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
            <p className="text-[11px] font-bold text-slate-500 mb-1 dark:text-slate-400">Available Numbers in <span className="text-slate-800 dark:text-slate-100">United States</span></p>
            {availableNumbers.map((opt) => (
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
            {error && (
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
                placeholder="Search Country, Area Code or Number..."
                className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {countryFilters.map((cf, i) => (
                <button
                  key={cf.label}
                  onClick={() => setActiveFilter(i)}
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
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Available Numbers in <span className="text-slate-800 dark:text-slate-100">United States</span></p>
            {availableNumbers.map((opt) => (
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
            {error && (
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
