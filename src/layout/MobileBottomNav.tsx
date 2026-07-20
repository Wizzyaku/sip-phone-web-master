import { NavLink, useLocation } from 'react-router-dom';
import { Home, Phone, MessageSquare, Contact, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

const items = [
  { icon: Home, label: 'Home', path: '/dashboard', isCenter: false },
  { icon: MessageSquare, label: 'SMS', path: '/messages', isCenter: false },
  { icon: Phone, label: 'Calls', path: '/calls', isCenter: true },
  { icon: Contact, label: 'Contacts', path: '/contacts', isCenter: false },
  { icon: Settings, label: 'Settings', path: '/settings', isCenter: false },
] as const;

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="mx-4 mb-4 flex h-16 items-center justify-around rounded-3xl border border-slate-200/80 bg-white/95 px-2 shadow-[0_10px_40px_rgba(66,65,188,0.08)] backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

          if (item.isCenter) {
            return (
              <NavLink
                key={item.label}
                to={item.path}
                className="relative flex w-14 flex-col items-center gap-1 pt-1.5 transition-transform active:scale-95"
              >
                {isActive && (
                  <div className="absolute -top-3 h-10 w-10 rounded-full bg-indigo-600/10 blur-md" />
                )}
                <Icon
                  className={cn(
                    'relative z-10 h-[22px] w-[22px]',
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  )}
                  fill={isActive ? 'currentColor' : 'none'}
                />
                <span
                  className={cn(
                    'relative z-10 text-[9px] font-extrabold',
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.path}
              className="flex w-12 flex-col items-center gap-1 pt-1 transition-colors active:scale-95"
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
                )}
              />
              <span
                className={cn(
                  'text-[9px] font-bold',
                  isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
