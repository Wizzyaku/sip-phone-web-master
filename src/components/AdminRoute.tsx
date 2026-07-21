import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { fetchProfile } from '../lib/profile';

export function AdminRequired() {
  const user = useAppStore((s) => s.user);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (mounted) setIsAdmin(false);
        return;
      }

      if (user.isAdmin === true) {
        if (mounted) setIsAdmin(true);
        return;
      }
      if (user.isAdmin === false) {
        if (mounted) setIsAdmin(false);
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
        if (mounted) setIsAdmin(profile.isAdmin);
      } else {
        if (mounted) setIsAdmin(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [setUser, user.isAdmin]);

  if (isAdmin === null) {
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
