import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { fetchProfile } from '../lib/profile';

export function AdminRequired() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      const profile = await fetchProfile();
      if (profile) {
        setUser({
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar,
          bio: profile.bio,
          isAdmin: profile.isAdmin,
        });
        setIsAdmin(profile.isAdmin);
      } else {
        setIsAdmin(false);
      }
      setChecking(false);
    };

    check();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!newSession) {
        setIsAdmin(false);
      } else {
        const profile = await fetchProfile();
        setIsAdmin(profile?.isAdmin ?? false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [setUser]);

  if (checking || isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
