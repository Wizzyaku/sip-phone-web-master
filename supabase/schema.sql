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
  telegram_chat_id text,
  telegram_enabled boolean default false,
  telegram_code text,
  telegram_code_expires_at timestamp with time zone,
  role text default 'user' check (role in ('user', 'admin')),
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
  locked_balance bigint not null default 0,
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

-- Function to safely debit tokens by a server-side caller.
-- Returns true if the debit succeeded, false if insufficient balance.
create or replace function public.debit_tokens(p_user_id uuid, p_tokens bigint, p_reference text)
returns boolean as $$
declare
  current_balance bigint;
begin
  select tokens into current_balance from public.user_balances where id = p_user_id for update;
  if current_balance is null or current_balance < p_tokens then
    return false;
  end if;
  update public.user_balances set tokens = current_balance - p_tokens where id = p_user_id;
  return true;
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
  next_billing_date timestamp with time zone default (now() + interval '30 days'),
  billing_status text default 'active',
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
  cost_coins bigint default 0,
  status text default 'completed',
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

-- ------------------------------------------------------------
-- 9. Messages log (SMS/MMS billing)
--    Records every SMS/MMS sent or received with billing info.
-- ------------------------------------------------------------
create table if not exists public.messages_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  message_sid text,
  direction text not null default 'outbound',
  type text not null default 'sms',
  segments integer default 1,
  from_number text,
  to_number text,
  cost_coins bigint default 0,
  status text default 'sent',
  created_at timestamp with time zone default now()
);

alter table public.messages_log enable row level security;

drop policy if exists "Users can read own messages_log" on public.messages_log;
create policy "Users can read own messages_log"
  on public.messages_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages_log" on public.messages_log;
create policy "Users can insert own messages_log"
  on public.messages_log for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 10. Billing extensions to transactions table
--     Add type and direction columns for billing ledger.
-- ------------------------------------------------------------
-- Add billing type column (call, sms, subscription, feature, topup, refund)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'transactions' and column_name = 'billing_type') then
    alter table public.transactions add column billing_type text default 'topup';
  end if;
end $$;

-- Add billing direction column (debit/credit)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'transactions' and column_name = 'billing_direction') then
    alter table public.transactions add column billing_direction text default 'credit';
  end if;
end $$;

-- ============================================================
-- BILLING RPC FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- reserve_coins: Lock coins for an active call
-- Moves coins from tokens to locked_balance atomically
-- ------------------------------------------------------------
create or replace function public.reserve_coins(p_user_id uuid, p_coins bigint)
returns boolean as $$
declare
  current_tokens bigint;
  current_locked bigint;
begin
  select tokens, locked_balance into current_tokens, current_locked
  from public.user_balances where id = p_user_id for update;

  if current_tokens is null or current_tokens < p_coins then
    return false;
  end if;

  update public.user_balances
  set tokens = current_tokens - p_coins,
      locked_balance = current_locked + p_coins
  where id = p_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- settle_call: Deduct exact call cost from locked balance, refund remainder
-- p_locked_amount = what was reserved, p_actual_cost = real cost
-- ------------------------------------------------------------
create or replace function public.settle_call(
  p_user_id uuid,
  p_locked_amount bigint,
  p_actual_cost bigint,
  p_call_id uuid,
  p_direction text,
  p_duration_seconds integer
)
returns bigint as $$
declare
  current_tokens bigint;
  current_locked bigint;
  refund_amount bigint;
begin
  select tokens, locked_balance into current_tokens, current_locked
  from public.user_balances where id = p_user_id for update;

  -- Refund = locked - actual cost (could be 0 if cost >= locked)
  refund_amount := greatest(p_locked_amount - p_actual_cost, 0);

  -- Ensure locked doesn't go negative
  if current_locked < p_locked_amount then
    -- locked was already partially consumed, just deduct what we can
    refund_amount := greatest(current_locked - p_actual_cost, 0);
  end if;

  update public.user_balances
  set tokens = current_tokens + refund_amount,
      locked_balance = greatest(current_locked - p_locked_amount, 0)
  where id = p_user_id;

  -- Log the transaction
  insert into public.transactions (
    user_id, reference, tokens, amount_minor, currency, provider,
    status, billing_type, billing_direction, metadata
  ) values (
    p_user_id,
    'CALL-' || p_call_id,
    p_actual_cost,
    0,
    'COINS',
    'billing',
    'success',
    'call',
    'debit',
    jsonb_build_object(
      'call_id', p_call_id,
      'direction', p_direction,
      'duration_seconds', p_duration_seconds,
      'cost_coins', p_actual_cost,
      'locked_coins', p_locked_amount,
      'refund_coins', refund_amount
    )
  );

  return refund_amount;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- charge_sms: Deduct coins for SMS/MMS
-- ------------------------------------------------------------
create or replace function public.charge_sms(
  p_user_id uuid,
  p_coins bigint,
  p_message_sid text,
  p_direction text,
  p_type text,
  p_segments integer
)
returns boolean as $$
declare
  current_tokens bigint;
begin
  select tokens into current_tokens
  from public.user_balances where id = p_user_id for update;

  if current_tokens is null or current_tokens < p_coins then
    return false;
  end if;

  update public.user_balances
  set tokens = current_tokens - p_coins
  where id = p_user_id;

  -- Log the transaction
  insert into public.transactions (
    user_id, reference, tokens, amount_minor, currency, provider,
    status, billing_type, billing_direction, metadata
  ) values (
    p_user_id,
    'SMS-' || p_message_sid,
    p_coins,
    0,
    'COINS',
    'billing',
    'success',
    'sms',
    'debit',
    jsonb_build_object(
      'message_sid', p_message_sid,
      'direction', p_direction,
      'type', p_type,
      'segments', p_segments,
      'cost_coins', p_coins
    )
  );

  return true;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- charge_subscription: Deduct monthly number subscription (5000 coins)
-- ------------------------------------------------------------
create or replace function public.charge_subscription(
  p_user_id uuid,
  p_coins bigint,
  p_phone_number text
)
returns boolean as $$
declare
  current_tokens bigint;
begin
  select tokens into current_tokens
  from public.user_balances where id = p_user_id for update;

  if current_tokens is null or current_tokens < p_coins then
    return false;
  end if;

  update public.user_balances
  set tokens = current_tokens - p_coins
  where id = p_user_id;

  -- Extend billing date by 30 days
  update public.phone_numbers
  set next_billing_date = now() + interval '30 days',
      billing_status = 'active',
      active = true
  where user_id = p_user_id and number = p_phone_number;

  -- Log the transaction
  insert into public.transactions (
    user_id, reference, tokens, amount_minor, currency, provider,
    status, billing_type, billing_direction, metadata
  ) values (
    p_user_id,
    'SUB-' || p_phone_number || '-' || extract(epoch from now())::bigint,
    p_coins,
    0,
    'COINS',
    'billing',
    'success',
    'subscription',
    'debit',
    jsonb_build_object(
      'phone_number', p_phone_number,
      'cost_coins', p_coins
    )
  );

  return true;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- charge_feature: Deduct coins for features (recording, AI, conference)
-- ------------------------------------------------------------
create or replace function public.charge_feature(
  p_user_id uuid,
  p_coins bigint,
  p_feature_type text,
  p_metadata jsonb default null
)
returns boolean as $$
declare
  current_tokens bigint;
begin
  select tokens into current_tokens
  from public.user_balances where id = p_user_id for update;

  if current_tokens is null or current_tokens < p_coins then
    return false;
  end if;

  update public.user_balances
  set tokens = current_tokens - p_coins
  where id = p_user_id;

  insert into public.transactions (
    user_id, reference, tokens, amount_minor, currency, provider,
    status, billing_type, billing_direction, metadata
  ) values (
    p_user_id,
    'FEAT-' || p_feature_type || '-' || extract(epoch from now())::bigint,
    p_coins,
    0,
    'COINS',
    'billing',
    'success',
    'feature',
    'debit',
    jsonb_build_object(
      'feature_type', p_feature_type,
      'cost_coins', p_coins
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  return true;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- get_wallet: Return balance and locked amount
-- ------------------------------------------------------------
create or replace function public.get_wallet(p_user_id uuid)
returns table(tokens bigint, locked_balance bigint) as $$
begin
  return query
    select b.tokens, b.locked_balance
    from public.user_balances b
    where b.id = p_user_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- Ensure profiles has the admin role column (idempotent for existing DBs)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists role text default 'user' check (role is null or role in ('user', 'admin'));

-- ------------------------------------------------------------
-- admin_logs: Audit trail for administrative actions
-- ------------------------------------------------------------
create table if not exists public.admin_logs (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users(id) on delete set null,
  admin_name text,
  admin_email text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb default null,
  created_at timestamp with time zone default now()
);

alter table public.admin_logs enable row level security;

drop policy if exists "Admins can read admin_logs" on public.admin_logs;
create policy "Admins can read admin_logs"
  on public.admin_logs
  for select
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins can insert admin_logs" on public.admin_logs;
create policy "Admins can insert admin_logs"
  on public.admin_logs
  for insert
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
