import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { SipProvider } from '../context/SipContext';
import { cn } from '../lib/utils';

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SipProvider>
      <div className="flex min-h-screen bg-[#F0F4F8] dark:bg-slate-950">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div
              className={cn(
                'absolute left-0 top-0 h-full w-[280px] shadow-2xl rounded-r-[24px] overflow-hidden'
              )}
            >
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:ml-[280px]">
          <Header onMenuClick={() => setMobileOpen((open) => !open)} />
          <main className={cn('flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pt-16 lg:pt-16 pb-[90px] lg:pb-6', mobileOpen && 'overflow-hidden')}>
            <Outlet />
          </main>
          {!mobileOpen && <MobileBottomNav />}
        </div>
      </div>
    </SipProvider>
  );
}
