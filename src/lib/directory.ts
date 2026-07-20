import { supabase } from './supabase';

export interface DirectoryUser {
  name: string;
  sipUsername: string;
}

function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export async function lookupUserByPhone(phone: string): Promise<DirectoryUser | null> {
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 7) return null;

  const { data, error } = await supabase.rpc('lookup_user_by_phone', {
    target_phone: phone,
  });

  if (error) {
    console.error('Failed to look up user by phone:', error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const row = data[0] as { name?: string; sip_username?: string };
  if (!row.sip_username) return null;
  return {
    name: row.name || 'App user',
    sipUsername: row.sip_username,
  };
}
