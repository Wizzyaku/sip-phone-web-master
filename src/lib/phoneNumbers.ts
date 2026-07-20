import { supabase } from './supabase';

export interface PhoneNumberRecord {
  id: string;
  number: string;
  label: string;
  flag: string;
  features: string[];
  active: boolean;
  forwarding: string | null;
  voicemail: boolean;
  monthly_cost: number;
}

export async function fetchUserPhoneNumbers(): Promise<PhoneNumberRecord[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return [];

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch phone numbers:', error.message);
    return [];
  }

  return (data || []) as PhoneNumberRecord[];
}

export async function insertPhoneNumber(
  number: string,
  flag: string,
  features: string[],
  monthlyCost: number,
  label?: string
): Promise<PhoneNumberRecord | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data, error } = await supabase
    .from('phone_numbers')
    .insert({
      user_id: session.user.id,
      number,
      flag,
      features,
      monthly_cost: monthlyCost,
      label: label || '',
    })
    .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost')
    .single();

  if (error) {
    console.error('Failed to insert phone number:', error.message);
    return null;
  }

  return data as PhoneNumberRecord;
}

export async function togglePhoneNumberActive(id: string, active: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('phone_numbers')
    .update({ active })
    .eq('id', id);

  if (error) {
    console.error('Failed to toggle phone number:', error.message);
    return false;
  }

  return true;
}

export async function deletePhoneNumber(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('phone_numbers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete phone number:', error.message);
    return false;
  }

  return true;
}
