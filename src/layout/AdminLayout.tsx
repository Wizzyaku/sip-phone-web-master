import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { supabase } from '../lib/supabase';

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', to: '/admin' },
  { icon: 'phone_iphone', label: 'Phone Numbers', to: '/admin/numbers' },
  { icon: 'chat', label: 'Messages', to: '/admin/messages' },
  { icon: 'group', label: 'Users', to: '/admin/users' },
  { icon: 'call', label: 'Calls', to: '/admin/calls' },
  { icon: 'payments', label: 'Billing', to: '/admin/payments' },
  { icon: 'support_agent', label: 'Support', to: '/admin/support' },
  { icon: 'settings', label: 'Settings', to: '/admin/settings' },
];

const mobileNavItems = [
  { icon: 'home', label: 'Home', to: '/admin' },
  { icon: 'phone_iphone', label: 'Numbers', to: '/admin/numbers' },
  { icon: 'sms', label: 'SMS', to: '/admin/messages' },
  { icon: 'payments', label: 'Billing', to: '/admin/payments' },
];

export function AdminLayout() {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {
      const store = useAppStore.getState();
      document.documentElement.classList.toggle('dark', store.resolvedTheme === 'dark');
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const avatarUrl =
    user.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Admin')}&background=4241bc&color=fff&size=128`;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  function navClass({ isActive }: { isActive: boolean }) {
    const base = 'flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 text-[13px] font-semibold';
    return isActive
      ? `${base} bg-primary/10 text-primary`
      : `${base} text-on-surface-variant hover:text-primary hover:bg-primary/5`;
  }

  function mobileNavClass({ isActive }: { isActive: boolean }) {
    const base = 'flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all active:scale-90';
    return isActive
      ? `${base} bg-primary-container text-on-primary-container`
      : `${base} text-on-surface-variant hover:text-primary`;
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-on-background font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[260px] shadow-2xl">
            <SidebarContent user={user} avatarUrl={avatarUrl} onLogout={handleLogout} onNavigate={() => setSidebarOpen(false)} navClass={navClass} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed h-full w-[260px] left-0 top-0 z-40 hidden md:flex flex-col bg-white border-r border-slate-200/80">
        <SidebarContent user={user} avatarUrl={avatarUrl} onLogout={handleLogout} navClass={navClass} />
      </aside>

      {/* Header */}
      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-260px)] h-16 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 md:px-6">
        {/* Left: Logo (mobile) + Search */}
        <div className="flex items-center gap-3 flex-1">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <img src="/phonicity2.png" alt="Phonicity" className="h-9 w-9 object-contain rounded-md" />
            <h1 className="text-base font-extrabold tracking-tight text-slate-800">Phonicity</h1>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden material-symbols-outlined text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            menu
          </button>

          {/* Desktop search */}
          <div className="relative hidden md:block w-full max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              className="w-full bg-slate-50 border border-slate-200/80 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all outline-none text-slate-700"
              placeholder="Search users, numbers, or logs..."
              type="text"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          <button className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 active:scale-95">
            <span className="material-symbols-outlined text-sm text-indigo-500">bolt</span>
            Recharge
          </button>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <button className="material-symbols-outlined p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 text-lg">
            notifications
          </button>

          <div className="flex items-center gap-2 ml-1">
            <div className="w-9 h-9 rounded-full border-2 border-indigo-200 p-0.5 overflow-hidden shrink-0">
              <img className="w-full h-full object-cover rounded-full" src={avatarUrl} alt={user.name || 'Admin'} />
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 truncate">Administrator</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 pb-24 md:pb-6 ml-0 md:ml-[260px] px-4 md:px-6 transition-all duration-300">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <footer className="fixed bottom-0 w-full h-16 md:hidden bg-white border-t border-slate-200/80 z-40 flex justify-around items-center px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {mobileNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={mobileNavClass}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </footer>
    </div>
  );
}

function SidebarContent({
  user,
  avatarUrl,
  onLogout,
  onNavigate,
  navClass,
}: {
  user: { name?: string; email?: string; avatar?: string };
  avatarUrl: string;
  onLogout: () => void;
  onNavigate?: () => void;
  navClass: (props: { isActive: boolean }) => string;
}) {
  return (
    <div className="flex flex-col h-full py-4 px-3 bg-white">
      {/* Brand */}
      <div className="mb-5 px-2 flex items-center gap-2.5">
        <img src="/phonicity2.png" alt="Phonicity" className="h-9 w-9 object-contain rounded-md shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base font-extrabold leading-tight text-slate-800 truncate">Phonicity</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Panel</p>
        </div>
      </div>

      {/* User mini-card */}
      <div className="mb-4 mx-1 flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5">
        <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200 shrink-0">
          <img src={avatarUrl} alt={user.name || 'Admin'} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate">{user.name || 'Admin'}</p>
          <p className="text-[10px] text-slate-500 truncate">{user.email || ''}</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={navClass} onClick={onNavigate}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-3 border-t border-slate-200/80 flex flex-col gap-0.5">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 py-2.5 px-3 rounded-xl text-[13px] font-bold text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Sign Out
        </button>
      </div>
    </div>
  );
}
