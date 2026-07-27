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
  next_billing_date: string | null;
  billing_status: string | null;
}

export async function fetchUserPhoneNumbers(): Promise<PhoneNumberRecord[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return [];

  // Try with billing columns first; fall back without them if columns don't exist yet
  let data: PhoneNumberRecord[] | null = null;
  let error: { message: string } | null = null;

  const primary: any = await supabase
    .from('phone_numbers')
    .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost, next_billing_date, billing_status')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (primary.error) {
    // Retry without billing columns (they may not exist in the DB yet)
    const fallback: any = await supabase
      .from('phone_numbers')
      .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    data = (fallback.data || []) as PhoneNumberRecord[];
    error = fallback.error;
  } else {
    data = (primary.data || []) as PhoneNumberRecord[];
  }

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

  const insertRes: any = await supabase
    .from('phone_numbers')
    .insert({
      user_id: session.user.id,
      number,
      flag,
      features,
      monthly_cost: monthlyCost,
      label: label || '',
    })
    .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost, next_billing_date, billing_status')
    .single();

  // If billing columns don't exist, retry without them
  if (insertRes.error && insertRes.error.message?.includes('next_billing_date')) {
    const fallback: any = await supabase
      .from('phone_numbers')
      .select('id, number, label, flag, features, active, forwarding, voicemail, monthly_cost')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    return (fallback.data || null) as PhoneNumberRecord | null;
  }

  if (insertRes.error) {
    console.error('Failed to insert phone number:', insertRes.error.message);
    return null;
  }

  return insertRes.data as PhoneNumberRecord;
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
