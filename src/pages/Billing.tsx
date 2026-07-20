import { useEffect, useMemo, useState, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet,
  Coins,
  CreditCard,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  History,
  Zap,
  Plus,
  ChevronRight,
  ArrowDown,
  Lock,
  X,
} from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { useAppStore } from '../store/appStore';
import {
  TOKEN_PACKAGES,
  fetchTransactions,
  formatTokens,
  formatCurrency,
  type Transaction,
} from '../lib/balance';
import { cn } from '../lib/utils';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { supabase } from '../lib/supabase';

type PaymentModalMode = 'topup' | 'tokens' | null;

export function Billing() {
  const [searchParams] = useSearchParams();
  const balance = useAppStore((s) => s.balance);
  const balanceLoading = useAppStore((s) => s.balanceLoading);
  const refreshBalance = useAppStore((s) => s.refreshBalance);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(1);
  const [customTokens, setCustomTokens] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<PaymentModalMode>(null);
  const [selectedAmount, setSelectedAmount] = useState<string>('50.00');
  const isDesktop = useIsDesktop();

  const reference = searchParams.get('reference');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await fetchTransactions();
      if (mounted) {
        setTransactions(data);
        setTransactionsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reference) {
      refreshBalance();
    }
  }, [reference, refreshBalance]);

  const activePackage = useMemo(() => {
    if (selectedPackage !== null) return TOKEN_PACKAGES[selectedPackage];
    const tokens = Math.max(0, Number(customTokens));
    if (tokens > 0) {
      return {
        tokens,
        label: `${formatTokens(tokens)} tokens`,
        priceMinor: tokens * 100,
        currency: 'NGN',
      };
    }
    return null;
  }, [selectedPackage, customTokens]);

  const handlePay = async () => {
    setError(null);
    setSuccess(null);

    if (!activePackage) {
      setError('Select a token package or enter a custom amount.');
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setError('You must be signed in to add funds.');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/korapay-initiate-charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageIndex: selectedPackage,
          customTokens: selectedPackage === null ? Number(customTokens) : undefined,
        }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        reference?: string;
        error?: string;
        korapayMessage?: string;
      };
      if (!response.ok || data.error) {
        console.error('Korapay initiate response:', { status: response.status, data });
        throw new Error(data.korapayMessage || data.error || 'Payment initialization failed.');
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setProcessing(false);
    }
  };

  const openPaymentModal = (mode: 'topup' | 'tokens') => {
    setPaymentModal(mode);
    setSelectedAmount('50.00');
    setError(null);
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    setSelectedAmount('50.00');
  };

  const selectAmount = (amount: string) => {
    setSelectedAmount(amount);
  };

  const displayBalance = balanceLoading || balance === null
    ? '—'
    : formatTokens(balance.tokens);

  const modalTitle = paymentModal === 'topup' ? 'Top Up Wallet' : 'Buy Tokens';

  return (
    <div className="relative h-[calc(100vh-8rem)] w-full min-w-0 overflow-hidden bg-background md:h-[calc(100vh-7.5rem)] md:rounded-2xl md:border md:border-border/30">
      {/* ========================================== */}
      {/* MOBILE VIEW                                 */}
      {/* ========================================== */}
      {!isDesktop && (
        <div className="absolute inset-0 flex flex-col bg-[#F0F4F8] dark:bg-slate-950">
          {/* Mobile Header */}
          <header className="shrink-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 pt-4 pb-3 px-4 flex items-center justify-between z-20 dark:bg-slate-900/90 dark:border-slate-700/50">
            <h1 className="text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Billing & Wallet</h1>
          </header>

          {/* Scrollable Content */}
          <div className="flex-grow overflow-y-auto no-scrollbar px-4 pt-3 pb-[10px] flex flex-col gap-3.5 z-10">
            {/* 1. Wallet / Balance Hero Card */}
            <div className="animate-fade-in shrink-0 relative overflow-hidden hero-card rounded-[20px] shadow-[0_8px_25px_rgba(15,23,42,0.15)] p-4 flex flex-col gap-4">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl z-0" />
              <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl z-0" />

              <div className="relative z-10 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-200" />
                  <span className="text-[10px] font-extrabold text-indigo-200 uppercase tracking-widest">Token Balance</span>
                </div>
                <div className="flex items-end gap-2 mt-1">
                  <span className="text-[32px] font-extrabold text-white tracking-tight leading-none">{displayBalance}</span>
                  <span className="text-[11px] font-bold text-indigo-200 mb-1">tokens</span>
                </div>
              </div>

              <div className="relative z-10 flex gap-2.5 mt-1">
                <button
                  onClick={() => openPaymentModal('topup')}
                  className="flex-1 h-11 bg-white text-indigo-600 hover:bg-slate-50 rounded-[12px] text-[13px] font-extrabold flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" /> Add Funds
                </button>
                <button
                  onClick={() => openPaymentModal('tokens')}
                  className="flex-1 h-11 bg-indigo-500 border border-indigo-400 text-white hover:bg-indigo-400 rounded-[12px] text-[13px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Coins className="w-4 h-4" /> Buy Tokens
                </button>
              </div>
            </div>

            {/* 2. Subscription Plan Overview */}
            <div className="animate-fade-in animate-delay-100 shrink-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-3.5 flex flex-col gap-3 dark:bg-slate-900 dark:border-slate-700/50">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[14px] font-bold text-slate-800 tracking-tight dark:text-slate-100">Current Plan</h3>
                <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[6px] uppercase tracking-widest border border-emerald-100">Active</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-[14px] p-3 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
                <div className="flex flex-col gap-1">
                  <h4 className="text-[14px] font-extrabold text-slate-800 leading-tight dark:text-slate-100">Pay As You Go</h4>
                  <p className="text-[10px] font-medium text-slate-500">1 NGN per token</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[14px] font-extrabold text-indigo-600 leading-tight">₦1.00<span className="text-[9px] text-slate-400">/tok</span></span>
                </div>
              </div>
            </div>

            {/* 3. Token Packages */}
            <div className="animate-fade-in animate-delay-200 shrink-0 flex flex-col gap-2.5">
              <div className="flex justify-between items-end px-1">
                <h3 className="text-[14px] font-bold text-slate-800 tracking-tight dark:text-slate-100">Token Packages</h3>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col divide-y divide-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/50">
                {TOKEN_PACKAGES.map((pkg, index) => (
                  <button
                    key={pkg.tokens}
                    onClick={() => {
                      setSelectedPackage(index);
                      setCustomTokens('');
                      openPaymentModal('tokens');
                    }}
                    className="p-3.5 flex items-center justify-between active:bg-slate-50 transition-colors text-left dark:active:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[10px] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 dark:bg-indigo-900/30 dark:border-indigo-800">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{pkg.label}</h4>
                        <span className="text-[10px] font-medium text-slate-500">{formatTokens(pkg.tokens)} tokens</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-extrabold text-indigo-600">{formatCurrency(pkg.priceMinor, pkg.currency)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Recent Transactions */}
            <div className="animate-fade-in animate-delay-300 shrink-0 flex flex-col gap-2.5 mt-1">
              <div className="flex justify-between items-end px-1">
                <h3 className="text-[14px] font-bold text-slate-800 tracking-tight dark:text-slate-100">Recent Transactions</h3>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col divide-y divide-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/50">
                {transactionsLoading ? (
                  <div className="p-3.5 flex flex-col gap-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-32 rounded" />
                          <Skeleton className="h-2 w-24 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="p-6 text-center">
                    <History className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-500">No transactions yet</p>
                    <p className="text-xs text-slate-400 mt-1">Your top-up history will appear here.</p>
                  </div>
                ) : (
                  transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="p-3.5 flex items-center justify-between active:bg-slate-50 transition-colors dark:active:bg-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-900/20">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100">+{formatTokens(tx.tokens)} tokens</h4>
                          <span className="text-[9.5px] font-medium text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[13px] font-extrabold text-emerald-500">{formatCurrency(tx.amountMinor, tx.currency)}</span>
                        <span className={cn(
                          'text-[9px] font-bold px-1.5 rounded',
                          tx.status === 'success' ? 'text-emerald-600 bg-emerald-50' : tx.status === 'pending' ? 'text-amber-500 bg-amber-50' : 'text-red-500 bg-red-50'
                        )}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reference notice */}
            {reference && (
              <div className="animate-fade-in shrink-0 bg-emerald-50 border border-emerald-100 rounded-[14px] p-3.5 flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold text-emerald-700">Payment reference received</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Ref: {reference.slice(0, 20)}. Your balance will update automatically.</p>
                </div>
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div className="shrink-0 flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-100 rounded-[12px] p-3">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            {success && (
              <div className="shrink-0 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-[12px] p-3">
                <CheckCircle className="w-3.5 h-3.5" />
                {success}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DESKTOP VIEW                                */}
      {/* ========================================== */}
      {isDesktop && (
        <div className="hidden lg:block h-full overflow-y-auto no-scrollbar bg-[#F0F4F8] dark:bg-slate-950">
          <div className="p-8 pb-8 flex flex-col gap-5 max-w-[1200px] mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[24px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Billing & Wallet</h1>
                <p className="text-[13px] font-medium text-slate-500 mt-0.5">Manage your balance, tokens, and payment history.</p>
              </div>
              <button
                onClick={() => refreshBalance()}
                className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                <Wallet className="w-4 h-4" /> Refresh Balance
              </button>
            </div>

            <div className="grid grid-cols-12 gap-5">
              {/* Left Column: Wallet & Packages */}
              <div className="col-span-7 flex flex-col gap-5">
                {/* Wallet Hero Card */}
                <div className="relative overflow-hidden hero-card rounded-[24px] shadow-[0_8px_25px_rgba(15,23,42,0.15)] p-6 flex flex-col gap-5">
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/30 rounded-full blur-3xl z-0" />
                  <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl z-0" />

                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-indigo-200" />
                        <span className="text-[11px] font-extrabold text-indigo-200 uppercase tracking-widest">Token Balance</span>
                      </div>
                      <div className="flex items-end gap-2 mt-1">
                        <span className="text-[40px] font-extrabold text-white tracking-tight leading-none">{displayBalance}</span>
                        <span className="text-[13px] font-bold text-indigo-200 mb-1.5">tokens</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-indigo-200">1 NGN / token</p>
                      <p className="text-[13px] font-semibold text-white mt-0.5">₦1.00 minimum</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex gap-3 mt-2">
                    <button
                      onClick={() => openPaymentModal('topup')}
                      className="flex-1 h-12 bg-white text-indigo-600 hover:bg-slate-50 rounded-[14px] text-[14px] font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-95 transition-transform"
                    >
                      <Plus className="w-5 h-5" /> Add Funds
                    </button>
                    <button
                      onClick={() => openPaymentModal('tokens')}
                      className="flex-1 h-12 bg-indigo-500 border border-indigo-400 text-white hover:bg-indigo-400 rounded-[14px] text-[14px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      <Coins className="w-5 h-5" /> Buy Tokens
                    </button>
                  </div>
                </div>

                {/* Token Packages */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-5 dark:bg-slate-900 dark:border-slate-700/50">
                  <h3 className="text-[16px] font-bold text-slate-800 tracking-tight mb-4 dark:text-slate-100">Select Token Package</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {TOKEN_PACKAGES.map((pkg, index) => (
                      <button
                        key={pkg.tokens}
                        onClick={() => {
                          setSelectedPackage(index);
                          setCustomTokens('');
                        }}
                        className={cn(
                          'flex items-center justify-between rounded-[16px] border-2 p-4 text-left transition-all',
                          selectedPackage === index
                            ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-900/20'
                            : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-700'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[12px] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800">
                            <Coins className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{pkg.label}</p>
                            <p className="text-[11px] text-slate-500">{formatTokens(pkg.tokens)} tokens</p>
                          </div>
                        </div>
                        <p className="text-[14px] font-extrabold text-indigo-600">{formatCurrency(pkg.priceMinor, pkg.currency)}</p>
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  <div className="mt-4 bg-slate-50 border border-slate-100 rounded-[16px] p-4 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Custom amount</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={100}
                        placeholder="Enter tokens (e.g. 2500)"
                        value={customTokens}
                        onChange={(e) => {
                          setCustomTokens(e.target.value);
                          setSelectedPackage(null);
                        }}
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      />
                      <span className="text-[13px] font-medium text-slate-500 whitespace-nowrap">tokens</span>
                    </div>
                    {customTokens && selectedPackage === null && (
                      <p className="text-[12px] font-bold text-indigo-600 mt-2">
                        Cost: {formatCurrency(Number(customTokens) * 100, 'NGN')}
                      </p>
                    )}
                  </div>

                  {/* Reference notice */}
                  {reference && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-[14px] p-3.5 flex items-start gap-2.5 dark:bg-emerald-900/20 dark:border-emerald-800">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">Payment reference received</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">Ref: {reference}. Your balance will update automatically once the payment is confirmed.</p>
                      </div>
                    </div>
                  )}

                  {/* Error / Success */}
                  {error && (
                    <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-red-50 border border-red-100 p-3 text-[13px] text-red-600 dark:bg-red-900/20 dark:border-red-800">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-emerald-50 border border-emerald-100 p-3 text-[13px] text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800">
                      <CheckCircle className="w-4 h-4" />
                      {success}
                    </div>
                  )}

                  {/* Pay Button */}
                  <button
                    className="mt-4 w-full h-14 rounded-[16px] text-[15px] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handlePay}
                    disabled={processing || !activePackage}
                    style={{
                      background: processing ? '#6366f1' : activePackage ? '#0f172a' : '#94a3b8',
                      color: '#fff',
                    }}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Initializing Korapay...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Pay {activePackage ? formatCurrency(activePackage.priceMinor, activePackage.currency) : ''}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Transaction History */}
              <div className="col-span-5 flex flex-col gap-5">
                <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] p-5 dark:bg-slate-900 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[16px] font-bold text-slate-800 tracking-tight dark:text-slate-100">Transaction History</h3>
                    <History className="w-5 h-5 text-slate-400" />
                  </div>
                  {transactionsLoading ? (
                    <div className="flex flex-col gap-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-32 rounded" />
                            <Skeleton className="h-2 w-24 rounded" />
                          </div>
                          <Skeleton className="h-6 w-16 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="py-8 text-center">
                      <History className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <p className="text-[14px] font-semibold text-slate-500">No top-ups yet</p>
                      <p className="text-[12px] text-slate-400 mt-1">Select a package to get started.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-100 max-h-[500px] overflow-y-auto no-scrollbar dark:divide-slate-700/50">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="py-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-900/20">
                              <ArrowDown className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-bold text-slate-800 truncate dark:text-slate-100">+{formatTokens(tx.tokens)} tokens</p>
                              <p className="text-[11px] text-slate-500">{new Date(tx.createdAt).toLocaleDateString()} • {tx.reference.slice(0, 12)}…</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn(
                              'text-[11px] font-bold uppercase',
                              tx.status === 'success' ? 'text-emerald-600' : tx.status === 'pending' ? 'text-amber-500' : 'text-red-500'
                            )}>
                              {tx.status}
                            </p>
                            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(tx.amountMinor, tx.currency)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* PAYMENT BOTTOM SHEET MODAL                  */}
      {/* ========================================== */}
      {paymentModal && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={closePaymentModal}
          />
          <div className="relative flex w-full flex-col rounded-t-[28px] bg-white pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900 max-w-[430px] mx-auto">
            {/* Drag Handle */}
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-4 dark:bg-slate-700" />

            <div className="px-5 flex flex-col gap-4">
              <div className="text-center relative">
                <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight dark:text-slate-100">{modalTitle}</h2>
                <p className="text-[11px] font-medium text-slate-500 mt-1">
                  Current balance: <span className="font-bold text-indigo-600">{displayBalance} tokens</span>
                </p>
                <button
                  onClick={closePaymentModal}
                  className="absolute -top-2 right-0 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform dark:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Select Amounts */}
              <div className="grid grid-cols-3 gap-2 mt-1">
                {['25.00', '50.00', '100.00'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => selectAmount(amt)}
                    className={cn(
                      'h-12 rounded-[14px] text-[15px] font-extrabold transition-colors active:scale-95',
                      selectedAmount === amt
                        ? 'bg-indigo-600 border border-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                        : 'bg-white border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    )}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Custom Amount Input */}
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">$</span>
                <input
                  type="number"
                  placeholder="Other amount"
                  value={selectedAmount !== '25.00' && selectedAmount !== '50.00' && selectedAmount !== '100.00' ? selectedAmount : ''}
                  onChange={(e) => selectAmount(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[14px] pl-8 pr-4 text-[14px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Pay With</span>
                <button className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-[14px] active:bg-slate-50 transition-colors dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 rounded-[8px] flex items-center justify-center text-white shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[13px] font-extrabold text-slate-800 leading-tight dark:text-slate-100">Korapay</span>
                      <span className="text-[10px] text-slate-500 font-medium mt-0.5">Secure Checkout</span>
                    </div>
                  </div>
                  <Lock className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handlePay}
                disabled={processing || !selectedAmount || Number(selectedAmount) <= 0}
                className="w-full h-12 mt-2 bg-slate-900 text-white rounded-[16px] text-[14px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.2)] disabled:opacity-50 dark:bg-indigo-600"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Pay ${selectedAmount}
                  </>
                )}
              </button>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-100 rounded-[12px] p-2.5 dark:bg-red-900/20 dark:border-red-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(Billing);
