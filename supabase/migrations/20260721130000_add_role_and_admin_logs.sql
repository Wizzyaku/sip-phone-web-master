alter table public.profiles
  add column if not exists role text default 'user' check (role is null or role in ('user', 'admin'));

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
