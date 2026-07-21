alter table public.profiles
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_enabled boolean default false,
  add column if not exists telegram_code text,
  add column if not exists telegram_code_expires_at timestamp with time zone;
