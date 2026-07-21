import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', to: '/admin' },
  { icon: 'phone_iphone', label: 'Phone Numbers', to: '/admin/numbers' },
  { icon: 'chat', label: 'Messages', to: '/admin/messages' },
  { icon: 'call', label: 'Calls', to: '/admin/calls' },
  { icon: 'dialpad', label: 'Dialer', to: '/admin/dialer' },
  { icon: 'contacts', label: 'Contacts', to: '/admin/contacts' },
  { icon: 'payments', label: 'Billing', to: '/admin/payments' },
  { icon: 'bar_chart', label: 'Usage', to: '/admin/usage' },
  { icon: 'settings', label: 'Settings', to: '/admin/settings' },
];

function navClass({ isActive }: { isActive: boolean }) {
  const base = 'flex items-center gap-md py-3 px-4 rounded-xl transition-all duration-200';
  return isActive
    ? `${base} active-nav-indicator bg-primary/5 text-primary font-semibold relative`
    : `${base} text-on-surface-variant hover:text-primary hover:bg-primary/10`;
}

export function AdminLayout() {
  const user = useAppStore((s) => s.user);
  const avatarUrl =
    user.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Admin')}&background=4241bc&color=fff&size=128`;

  return (
    <div className="min-h-screen bg-surface text-on-background font-sans">
      <aside
        className="fixed h-full w-[280px] left-0 top-0 backdrop-blur-xl border-r border-white/20 bg-white/20 z-50 hidden md:flex flex-col gap-base py-lg px-md shadow-[10px_0_30px_rgba(91,91,214,0.08)]"
        id="sidebar"
      >
        <div className="mb-lg flex items-center gap-sm">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-primary">ProConnect</h1>
            <p className="text-xs text-outline font-medium tracking-widest uppercase">Enterprise Tier</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={navClass}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-body-md text-body-md">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-lg border-t border-outline-variant/30 space-y-2">
          <Link
            to="/admin/help"
            className="flex items-center gap-md py-3 px-4 rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors duration-200"
          >
            <span className="material-symbols-outlined">help</span>
            <span className="font-body-md text-body-md">Help</span>
          </Link>
          <Link
            to="/logout"
            className="flex items-center gap-md py-3 px-4 rounded-xl text-error hover:bg-error-container/20 transition-colors duration-200"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-body-md text-body-md">Sign Out</span>
          </Link>
        </div>
      </aside>

      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-280px)] h-16 backdrop-blur-md z-40 bg-surface/80 border-b border-white/20 flex justify-between items-center px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-md w-full max-w-xl">
          <div className="relative w-full group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              className="w-full bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-label-md focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              placeholder="Search systems, users, or logs..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-md">
          <button className="hidden lg:flex items-center gap-xs font-label-md text-label-md uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">
            Recharge Tokens
          </button>
          <div className="h-6 w-px bg-outline-variant/30 hidden md:block"></div>
          <div className="flex items-center gap-sm">
            <button className="material-symbols-outlined p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
              notifications
            </button>
            <button className="material-symbols-outlined p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
              settings_brightness
            </button>
          </div>
          <div className="flex items-center gap-sm ml-2">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden">
              <img className="w-full h-full object-cover rounded-full" src={avatarUrl} alt={user.name || 'Admin'} />
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-24 md:pb-10 ml-0 md:ml-[280px] px-margin-mobile md:px-margin-desktop transition-all duration-300">
        <Outlet />
      </main>

      <footer className="fixed bottom-0 w-full h-16 md:hidden backdrop-blur-xl z-50 rounded-t-xl border-t border-white/20 bg-white/90 flex justify-around items-center px-4 shadow-[0_-10px_30px_rgba(91,91,214,0.08)]">
        <Link
          to="/admin"
          className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-4 py-1 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-sm text-[10px]">Home</span>
        </Link>
        <Link
          to="/admin/calls"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-90"
        >
          <span className="material-symbols-outlined">call</span>
          <span className="font-label-sm text-[10px]">Calls</span>
        </Link>
        <Link
          to="/admin/dialer"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-90"
        >
          <span className="material-symbols-outlined">dialpad</span>
          <span className="font-label-sm text-[10px]">Dialer</span>
        </Link>
        <Link
          to="/admin/messages"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-90"
        >
          <span className="material-symbols-outlined">sms</span>
          <span className="font-label-sm text-[10px]">SMS</span>
        </Link>
        <Link
          to="/admin/settings"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-all active:scale-90"
        >
          <span className="material-symbols-outlined">more_horiz</span>
          <span className="font-label-sm text-[10px]">More</span>
        </Link>
      </footer>

      <button className="fixed bottom-24 right-8 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all md:bottom-10 z-30 group">
        <span className="material-symbols-outlined text-3xl transition-transform group-hover:rotate-90">add</span>
      </button>
    </div>
  );
}
