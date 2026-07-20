import { supabase } from './supabase';

export interface CallLogRecord {
  id: string;
  remote_identity: string;
  direction: 'incoming' | 'outgoing';
  type: 'incoming' | 'outgoing' | 'missed' | 'voicemail';
  duration_seconds: number;
  recorded: boolean;
  created_at: string;
}

export async function fetchCallLogs(limit = 50): Promise<CallLogRecord[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return [];

  const { data, error } = await supabase
    .from('call_logs')
    .select('id, remote_identity, direction, type, duration_seconds, recorded, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch call logs:', error.message);
    return [];
  }

  return (data || []) as CallLogRecord[];
}

export async function insertCallLog(
  remoteIdentity: string,
  direction: 'incoming' | 'outgoing',
  type: 'incoming' | 'outgoing' | 'missed' | 'voicemail',
  durationSeconds: number,
  recorded = false
): Promise<CallLogRecord | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data, error } = await supabase
    .from('call_logs')
    .insert({
      user_id: session.user.id,
      remote_identity: remoteIdentity,
      direction,
      type,
      duration_seconds: durationSeconds,
      recorded,
    })
    .select('id, remote_identity, direction, type, duration_seconds, recorded, created_at')
    .single();

  if (error) {
    console.error('Failed to insert call log:', error.message);
    return null;
  }

  return data as CallLogRecord;
}

export async function deleteCallLog(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('call_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete call log:', error.message);
    return false;
  }

  return true;
}
