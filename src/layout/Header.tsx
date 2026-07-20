import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Moon, Sun, Check, X, Plus, Wallet, PhoneCall } from 'lucide-react';
import { useAppStore, unreadCount } from '../store/appStore';
import { formatTokens } from '../lib/balance';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { cn } from '../lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const setTheme = useAppStore((s) => s.setTheme);
  const notifications = useAppStore((s) => s.notifications);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const dismiss = useAppStore((s) => s.dismissNotification);
  const user = useAppStore((s) => s.user);
  const balance = useAppStore((s) => s.balance);
  const balanceLoading = useAppStore((s) => s.balanceLoading);
  const unread = useAppStore(unreadCount);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <header className="premium-header fixed top-0 right-0 z-30 flex h-16 w-full items-center justify-between px-4 lg:w-[calc(100%-280px)] lg:px-8">
      {/* Left: Logo / Desktop search */}
      <div className="flex flex-1 items-center gap-3">
        {/* Phonicity logo + name */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
            <PhoneCall className="h-5 w-5" />
          </div>
          <h1 className="text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Phonicity</h1>
        </div>

        {/* Desktop search */}
        <div className="relative hidden w-full max-w-md lg:block">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search numbers, calls, or messages..."
            className="h-10 rounded-full border border-border bg-card pl-10"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Desktop balance pill */}
        <button
          onClick={() => navigate('/billing')}
          className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 md:flex"
        >
          <Wallet className="h-3.5 w-3.5 text-indigo-500" />
          {balanceLoading || balance === null ? (
            <span className="inline-block h-3 w-10 animate-pulse rounded bg-muted" />
          ) : (
            <span>{formatTokens(balance.tokens)} tokens</span>
          )}
        </button>

        {/* Desktop top-up button */}
        <button
          onClick={() => navigate('/billing')}
          className="hidden items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all hover:bg-indigo-500 active:scale-95 md:flex"
        >
          <Plus className="h-3.5 w-3.5" />
          Top Up
        </button>

        {/* Notifications */}
        <div className="relative" ref={panelRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label="Notifications"
            onClick={() => setOpen((o) => !o)}
          >
            <Bell className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />}
          </Button>

          {open && (
            <div className="fixed right-4 top-16 mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800 lg:absolute lg:right-0 lg:top-full lg:w-80">
              <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2 dark:border-slate-700">
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Notifications</p>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                  Mark all read
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {notifications.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications</p>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-2 rounded-xl px-2 py-2 transition-colors',
                        n.read ? 'opacity-60' : 'bg-indigo-50 dark:bg-indigo-950/40'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{n.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!n.read && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markRead(n.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dismiss(n.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />
          ) : (
            <Moon className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />
          )}
        </Button>

        {/* Avatar */}
        <Avatar
          className="h-8 w-8 cursor-pointer border border-slate-200 bg-indigo-100 text-indigo-700 shadow-sm transition-transform active:scale-95 dark:border-slate-700 dark:bg-indigo-900 dark:text-indigo-200 lg:h-9 lg:w-9"
          onClick={onMenuClick}
        >
          <AvatarFallback className="text-xs font-extrabold">{user.avatar}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
