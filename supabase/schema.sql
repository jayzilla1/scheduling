-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'staff'))
);

create table if not exists public.staff (
  id text primary key,
  name text not null,
  user_id uuid unique references auth.users on delete set null
);

create table if not exists public.shifts (
  id bigint generated always as identity primary key,
  staff_id text not null references public.staff on delete cascade,
  day text not null check (day in ('mon','tue','wed','thu','fri')),
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  check (end_min > start_min)
);

-- Every new login becomes a regular 'staff' profile. Only Pam is promoted to admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.shifts enable row level security;

-- Anyone logged in can READ. Only the admin can CHANGE staff and shifts.
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "read staff" on public.staff for select to authenticated using (true);
create policy "read shifts" on public.shifts for select to authenticated using (true);
create policy "admin writes staff" on public.staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin writes shifts" on public.shifts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Starting data: staff and Pam's weekly template (Gianna's 3rd day = Thursday).
insert into public.staff (id, name) values
  ('naimah','Naimah'), ('mack','Mack'), ('gianna','Gianna')
on conflict do nothing;

insert into public.shifts (staff_id, day, start_min, end_min) values
  ('mack','mon',480,750), ('mack','tue',450,690), ('mack','wed',450,660),
  ('mack','wed',855,1035), ('mack','thu',870,1050), ('mack','fri',510,690),
  ('mack','fri',870,1050),
  ('naimah','mon',870,990), ('naimah','tue',510,690), ('naimah','tue',870,990),
  ('naimah','wed',510,750), ('naimah','thu',480,750), ('naimah','fri',480,690),
  ('gianna','mon',900,1050), ('gianna','wed',900,1050), ('gianna','thu',900,1050);
