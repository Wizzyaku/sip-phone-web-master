import { supabase } from './supabase';
import type { User } from '../store/appStore';

export interface ProfileData {
  name: string;
  email: string;
  bio: string;
  avatar: string;
  phoneNumber: string | null;
  role: string | null;
  isAdmin: boolean;
}

export async function fetchProfile(): Promise<ProfileData | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  let result = await supabase
    .from('profiles')
    .select('name, bio, avatar, phone_number, role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (result.error && (result.error.message?.includes('phone_number') || result.error.code === '42703')) {
    console.warn('profiles.phone_number not found, fetching without it:', result.error.message);
    result = await supabase
      .from('profiles')
      .select('name, bio, avatar, role')
      .eq('id', session.user.id)
      .maybeSingle();
  }

  const { data, error } = result;

  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return null;
  }

  if (!data) return null;

  return {
    name: data.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
    email: session.user.email || '',
    bio: data.bio || '',
    avatar: data.avatar || '',
    phoneNumber: (data as { phone_number?: string }).phone_number || null,
    role: data.role || 'user',
    isAdmin: data.role === 'admin',
  };
}

export async function saveProfile(user: User, phoneNumber: string | null): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    console.error('Cannot save profile: no active session');
    return false;
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      phone_number: phoneNumber,
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('Failed to save profile:', error.message);
    return false;
  }

  return true;
}
