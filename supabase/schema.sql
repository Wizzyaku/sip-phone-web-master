-- ============================================================
-- Unified Supabase schema for sip-phone-web
-- Run this once in the Supabase SQL Editor; it is idempotent.
-- ============================================================

-- Helper function to auto-update `updated_at` columns.
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 1. User profiles
--    Stores display name, bio, avatar, and the verified sender
--    phone number. One row per authenticated user.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  bio text,
  avatar text,
  phone_number text,
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 2. SIP credentials
--    Stores SIP login details so users don't have to re-enter
--    them on every device. One row per authenticated user.
-- ------------------------------------------------------------
create table if not exists public.sip_credentials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  username text not null,
  phone_number text not null,
  password text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.sip_credentials enable row level security;

drop policy if exists "Users can read own sip_credentials" on public.sip_credentials;
create policy "Users can read own sip_credentials"
  on public.sip_credentials
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own sip_credentials" on public.sip_credentials;
create policy "Users can insert own sip_credentials"
  on public.sip_credentials
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own sip_credentials" on public.sip_credentials;
create policy "Users can update own sip_credentials"
  on public.sip_credentials
  for update
  using (auth.uid() = user_id);

drop trigger if exists sip_credentials_updated_at on public.sip_credentials;
create trigger sip_credentials_updated_at
  before update on public.sip_credentials
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 3. Phone directory lookup
--    Lets authenticated users resolve a phone number to another
--    app user's SIP username for browser-to-browser calls.
--    Only exposes name and username; password stays private.
-- ------------------------------------------------------------
create or replace function public.lookup_user_by_phone(target_phone text)
returns table(name text, sip_username text) as $$
declare
  normalized text;
begin
  normalized := regexp_replace(target_phone, '[^0-9]', '', 'g');
  return query
    select p.name, s.username as sip_username
    from public.profiles p
    join public.sip_credentials s on p.id = s.user_id
    where regexp_replace(p.phone_number, '[^0-9]', '', 'g') = normalized
      and p.phone_number is not null
      and s.username is not null
    limit 1;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 4. User wallet balance
--    Stores token credits per authenticated user. Created on
--    first profile insert if it does not already exist.
-- ------------------------------------------------------------
create table if not exists public.user_balances (
  id uuid references auth.users(id) on delete cascade primary key,
  tokens bigint not null default 0,
  updated_at timestamp with time zone default now()
);

alter table public.user_balances enable row level security;

drop policy if exists "Users can read own balance" on public.user_balances;
create policy "Users can read own balance"
  on public.user_balances
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own balance" on public.user_balances;
create policy "Users can insert own balance"
  on public.user_balances
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own balance" on public.user_balances;
create policy "Users can update own balance"
  on public.user_balances
  for update
  using (auth.uid() = id);

-- Only the service role / webhook should be able to credit tokens directly.
-- Application updates should go through a serverless function or RPC.

-- Auto-create a balance row for every new profile.
create or replace function public.create_user_balance()
returns trigger as $$
begin
  insert into public.user_balances (id, tokens)
  values (new.id, 0)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists create_user_balance_on_profile on public.profiles;
create trigger create_user_balance_on_profile
  after insert on public.profiles
  for each row execute procedure public.create_user_balance();

-- ------------------------------------------------------------
-- 5. Transactions / payment history
--    Records every top-up attempt and final status.
-- ------------------------------------------------------------
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  reference text not null unique,
  tokens bigint not null,
  amount_minor bigint not null default 0,
  currency text not null default 'NGN',
  provider text not null default 'korapay',
  status text not null default 'pending',
  metadata jsonb default null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.transactions enable row level security;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users cannot update own transactions" on public.transactions;
create policy "Users cannot update own transactions"
  on public.transactions
  for update
  using (false);

drop trigger if exists user_balances_updated_at on public.user_balances;
create trigger user_balances_updated_at
  before update on public.user_balances
  for each row execute procedure public.handle_updated_at();

drop trigger if exists transactions_updated_at on public.transactions;
create trigger transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.handle_updated_at();

-- Function to safely credit tokens by a server-side caller.
create or replace function public.credit_tokens(p_user_id uuid, p_tokens bigint, p_reference text)
returns void as $$
begin
  insert into public.user_balances (id, tokens)
  values (p_user_id, p_tokens)
  on conflict (id) do update set tokens = public.user_balances.tokens + p_tokens;

  update public.transactions
  set status = 'success', updated_at = now()
  where reference = p_reference and user_id = p_user_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 6. User phone numbers
--    Stores virtual phone numbers purchased by each user.
--    One user can have multiple numbers across countries.
-- ------------------------------------------------------------
create table if not exists public.phone_numbers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  number text not null,
  label text default '',
  flag text default '',
  features text[] default '{}',
  active boolean default true,
  forwarding text,
  voicemail boolean default false,
  monthly_cost numeric default 7.0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.phone_numbers enable row level security;

drop policy if exists "Users can read own phone_numbers" on public.phone_numbers;
create policy "Users can read own phone_numbers"
  on public.phone_numbers
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own phone_numbers" on public.phone_numbers;
create policy "Users can insert own phone_numbers"
  on public.phone_numbers
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own phone_numbers" on public.phone_numbers;
create policy "Users can update own phone_numbers"
  on public.phone_numbers
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own phone_numbers" on public.phone_numbers;
create policy "Users can delete own phone_numbers"
  on public.phone_numbers
  for delete
  using (auth.uid() = user_id);

drop trigger if exists phone_numbers_updated_at on public.phone_numbers;
create trigger phone_numbers_updated_at
  before update on public.phone_numbers
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 7. Contacts
--    Stores personal contacts for each user.
-- ------------------------------------------------------------
create table if not exists public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null,
  email text default '',
  company text default '',
  favorite boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.contacts enable row level security;

drop policy if exists "Users can read own contacts" on public.contacts;
create policy "Users can read own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own contacts" on public.contacts;
create policy "Users can insert own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own contacts" on public.contacts;
create policy "Users can update own contacts"
  on public.contacts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own contacts" on public.contacts;
create policy "Users can delete own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 8. Call logs
--    Records metadata for every call made or received.
-- ------------------------------------------------------------
create table if not exists public.call_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  remote_identity text not null,
  direction text not null default 'outgoing',
  type text not null default 'outgoing',
  duration_seconds integer not null default 0,
  recorded boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.call_logs enable row level security;

drop policy if exists "Users can read own call_logs" on public.call_logs;
create policy "Users can read own call_logs"
  on public.call_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own call_logs" on public.call_logs;
create policy "Users can insert own call_logs"
  on public.call_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own call_logs" on public.call_logs;
create policy "Users can delete own call_logs"
  on public.call_logs for delete
  using (auth.uid() = user_id);
