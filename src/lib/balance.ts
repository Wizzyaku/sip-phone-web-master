import { supabase } from './supabase';

export const TOKEN_PACKAGES = [
  { tokens: 1000, label: '1,000 tokens', priceMinor: 100000, currency: 'NGN' },
  { tokens: 5000, label: '5,000 tokens', priceMinor: 450000, currency: 'NGN' },
  { tokens: 10000, label: '10,000 tokens', priceMinor: 800000, currency: 'NGN' },
  { tokens: 20000, label: '20,000 tokens', priceMinor: 1500000, currency: 'NGN' },
];

export interface Balance {
  tokens: number;
  updatedAt: string;
}

export const LOW_BALANCE_THRESHOLD = 10;

export function hasEnoughBalance(balance: Balance | null): boolean {
  return !!balance && balance.tokens >= LOW_BALANCE_THRESHOLD;
}

export interface Transaction {
  id: string;
  reference: string;
  tokens: number;
  amountMinor: number;
  currency: string;
  provider: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export async function fetchBalance(): Promise<Balance | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_balances')
    .select('tokens, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch balance:', error.message);
    return null;
  }

  if (!data) return { tokens: 0, updatedAt: new Date().toISOString() };

  return {
    tokens: Number(data.tokens),
    updatedAt: data.updated_at,
  };
}

export function subscribeToBalance(callback: (balance: Balance) => void) {
  const channel = supabase
    .channel('user_balance_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_balances' },
      async (payload) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const updated = payload.new as Record<string, unknown> | undefined;
        if (updated && updated.id === sessionData.session?.user.id) {
          callback({
            tokens: Number(updated.tokens),
            updatedAt: String(updated.updated_at),
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function createTransaction(
  tokens: number,
  amountMinor: number,
  currency: string,
  reference: string
): Promise<Transaction | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    console.error('Cannot create transaction: no active session');
    return null;
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      tokens,
      amount_minor: amountMinor,
      currency,
      reference,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create transaction:', error.message);
    return null;
  }

  return mapTransaction(data);
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch transactions:', error.message);
    return [];
  }

  return (data || []).map(mapTransaction);
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    reference: String(row.reference),
    tokens: Number(row.tokens),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    provider: String(row.provider),
    status: String(row.status) as Transaction['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatCurrency(minor: number, currency: string): string {
  const major = minor / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
}
