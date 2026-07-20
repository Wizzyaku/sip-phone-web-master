import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Phone,
  Contact,
  CreditCard,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { useAppStore, unreadMessages } from '../store/appStore';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'numbers', label: 'Phone Numbers', icon: Smartphone, path: '/numbers' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages' },
  { id: 'calls', label: 'Calls', icon: Phone, path: '/calls' },
  { id: 'contacts', label: 'Contacts', icon: Contact, path: '/contacts' },
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard, path: '/billing' },
  { id: 'usage', label: 'Analytics', icon: BarChart3, path: '/usage' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
] as const;

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const unreadMsgCount = useAppStore(unreadMessages);
  const location = useLocation();
  const user = useAppStore((s) => s.user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <aside className="relative flex h-full w-[280px] flex-col border-r border-slate-200/80 bg-white py-5 px-4 dark:border-slate-700/50 dark:bg-slate-900 lg:fixed lg:left-0 lg:top-0 lg:h-screen">
      {/* Brand */}
      <div className="mb-6 px-2 hidden lg:block">
        <div className="flex items-center gap-2.5">
          <img src="/phonicity.png" alt="Phonicity" className="h-11 w-11 object-contain rounded-md" />
          <div>
            <h1 className="text-base font-extrabold leading-tight text-slate-800 dark:text-slate-100">Phonicity</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise</p>
          </div>
        </div>
      </div>

      {/* User profile mini-card */}
      <div className="mb-4 hidden lg:flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-800/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 shrink-0">
          {user.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 truncate">{user.name}</h2>
          <p className="text-[10px] font-semibold text-slate-500 truncate">{user.email}</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const badgeCount = item.id === 'messages' ? unreadMsgCount : 0;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all',
                isActive
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-indigo-600 dark:text-indigo-400')} />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">
                  {badgeCount}
                </Badge>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col gap-1 border-t border-slate-200/80 pt-4 dark:border-slate-700/50">
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-[13px] font-extrabold text-white shadow-[0_4px_12px_rgba(99,102,241,0.25)] transition-all hover:bg-indigo-500 active:scale-95"
        >
          Buy Number
        </button>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            location.pathname.startsWith('/settings') && 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40'
          )}
        >
          <HelpCircle className="h-5 w-5" />
          Help & Support
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-extrabold text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
