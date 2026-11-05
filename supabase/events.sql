-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- (Run supabase/schema.sql first if you haven't.)

-- Events are private to the admin (they may have personal details like doctor visits).
create table if not exists public.events (
  id bigint generated always as identity primary key,
  title text not null,
  person text not null,               -- 'pam' or a staff id like 'naimah'
  date date not null,
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  check (end_min > start_min),
  created_at timestamptz not null default now()
);

-- One-day changes layered over the weekly template. Everyone can see these (no event titles).
create table if not exists public.schedule_changes (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('add', 'remove')),
  staff_id text not null references public.staff on delete cascade,
  date date not null,
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  check (end_min > start_min),
  event_id bigint references public.events on delete cascade
);

alter table public.events enable row level security;
alter table public.schedule_changes enable row level security;

create policy "admin reads events" on public.events for select to authenticated
  using (public.is_admin());
create policy "admin writes events" on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read changes" on public.schedule_changes for select to authenticated using (true);
create policy "admin writes changes" on public.schedule_changes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
