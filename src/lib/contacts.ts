import { supabase } from './supabase';

export interface ContactRecord {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  company: string;
  favorite: boolean;
  created_at: string;
}

export async function fetchContacts(): Promise<ContactRecord[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return [];

  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, company, favorite, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch contacts:', error.message);
    return [];
  }

  return (data || []) as ContactRecord[];
}

export async function insertContact(
  firstName: string,
  lastName: string,
  phone: string,
  email: string,
  company: string
): Promise<ContactRecord | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: session.user.id,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      company,
    })
    .select('id, first_name, last_name, phone, email, company, favorite, created_at')
    .single();

  if (error) {
    console.error('Failed to insert contact:', error.message);
    return null;
  }

  return data as ContactRecord;
}

export async function toggleContactFavorite(id: string, favorite: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('contacts')
    .update({ favorite })
    .eq('id', id);

  if (error) {
    console.error('Failed to toggle favorite:', error.message);
    return false;
  }

  return true;
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete contact:', error.message);
    return false;
  }

  return true;
}
