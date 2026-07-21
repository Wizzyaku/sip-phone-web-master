import { useEffect, lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useRouteError, Outlet } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationToast } from './components/NotificationToast';
import { Skeleton } from './components/ui/skeleton';
import { Button } from './components/ui/button';
import { initTheme, useAppStore } from './store/appStore';
import { useNotifications } from './hooks/useNotifications';
import { useBalance } from './hooks/useBalance';
import { AuthRequired } from './components/AuthRoute';
import { AdminRequired } from './components/AdminRoute';
import { AdminLayout } from './layout/AdminLayout';
import { AuthModal } from './components/AuthModal';
import { ScrollToTop } from './components/ScrollToTop';
import { supabase } from './lib/supabase';
import { fetchProfile } from './lib/profile';

const Home = lazy(() => import('./pages/Home'));
const Contact = lazy(() => import('./pages/Contact'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calls = lazy(() => import('./pages/Calls'));
const Messages = lazy(() => import('./pages/Messages'));
const Contacts = lazy(() => import('./pages/Contacts'));
const PhoneNumbers = lazy(() => import('./pages/PhoneNumbers'));
const Billing = lazy(() => import('./pages/Billing'));
const Usage = lazy(() => import('./pages/Usage'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const NotFound = lazy(() => import('./pages/NotFound'));

const pageFallback = (
  <div className="space-y-4 p-4">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

function AppProviders() {
  const setUser = useAppStore((s) => s.setUser);
  const setTelnyxNumber = useAppStore((s) => s.setTelnyxNumber);

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await fetchProfile();
      if (profile) {
        setUser({
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar,
          bio: profile.bio,
          isAdmin: profile.isAdmin,
        });
        setTelnyxNumber(profile.phoneNumber);
      }
    };

    loadProfile();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadProfile();
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [setUser, setTelnyxNumber]);

  useNotifications();
  useBalance();

  return <NotificationToast />;
}

function RouteError() {
  const error = useRouteError() as Error | { statusText?: string; message?: string };
  const message = 'message' in error ? error.message : 'statusText' in error ? error.statusText : 'Unknown error';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">An unexpected routing error occurred.</p>
        {message && <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">{message}</pre>}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteError />,
    element: (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'contact', element: <Contact /> },
    ],
  },
  {
    path: '/',
    element: <AuthRequired />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'calls', element: <Calls /> },
          { path: 'messages', element: <Messages /> },
          { path: 'contacts', element: <Contacts /> },
          { path: 'numbers', element: <PhoneNumbers /> },
          { path: 'billing', element: <Billing /> },
          { path: 'usage', element: <Usage /> },
          { path: 'settings', element: <Settings /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
  {
    path: 'admin',
    element: <AdminRequired />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminOverview /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={pageFallback}>
        <AppProviders />
        <RouterProvider router={router} />
        <AuthModal />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
