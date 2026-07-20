import { supabase } from './supabase';
import type { SipSettings } from '../store/appStore';

export async function fetchSipCredentials(): Promise<SipSettings | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('sip_credentials')
    .select('username, phone_number, password')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch SIP credentials:', error.message);
    return null;
  }

  if (!data) return null;

  return {
    username: data.username,
    password: data.password,
    phoneNumber: data.phone_number,
  };
}

export async function saveSipCredentials(settings: SipSettings): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    console.error('Cannot save SIP credentials: no active session');
    return false;
  }

  const { error } = await supabase.from('sip_credentials').upsert(
    {
      user_id: userId,
      username: settings.username,
      phone_number: settings.phoneNumber,
      password: settings.password,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('Failed to save SIP credentials:', error.message);
    return false;
  }

  return true;
}
