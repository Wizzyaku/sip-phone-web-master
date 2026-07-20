import { useEffect } from 'react';
import { subscribeToBalance } from '../lib/balance';
import { useAppStore } from '../store/appStore';

export function useBalance() {
  const refreshBalance = useAppStore((s) => s.refreshBalance);
  const setBalance = useAppStore((s) => s.setBalance);
  const balance = useAppStore((s) => s.balance);
  const balanceLoading = useAppStore((s) => s.balanceLoading);

  useEffect(() => {
    refreshBalance();
    const unsubscribe = subscribeToBalance((newBalance) => {
      setBalance(newBalance);
    });
    return () => {
      unsubscribe();
    };
  }, [refreshBalance, setBalance]);

  return { balance, balanceLoading };
}
