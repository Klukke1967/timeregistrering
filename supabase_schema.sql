-- ============================================================
-- TIMEREGISTRERING - SUPABASE SCHEMA & RLS POLICIES (FASE 1)
-- Projekt: https://lvrpyjoidfybgqbuzuqc.supabase.co
-- ============================================================

-- 1. TABELLER
-- ------------------------------------------------------------

-- Profiler & Roller (koblet til Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- Timeregistreringer
create table if not exists public.time_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  entry_date date not null,
  hours numeric(4,2) not null check (hours > 0 and hours <= 24),
  project_task text not null,
  note text,
  created_at timestamptz default now()
);

-- Indeksering for hurtig søgning og filtrering
create index if not exists idx_time_entries_user_date on public.time_entries(user_id, entry_date);
create index if not exists idx_time_entries_date on public.time_entries(entry_date);


-- 2. AUTO-PROFIL TRIGGER PÅ AUTH.USERS
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. HJÆLPEFUNKTION TIL ADMIN-TJEK (Undgår RLS-rekursion)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer set search_path = public;


-- 4. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.time_entries enable row level security;

-- PROFILES POLICIES
drop policy if exists "Profiles select policy" on public.profiles;
create policy "Profiles select policy" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Profiles update policy" on public.profiles;
create policy "Profiles update policy" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- TIME_ENTRIES POLICIES
drop policy if exists "Time entries select policy" on public.time_entries;
create policy "Time entries select policy" on public.time_entries
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Time entries insert policy" on public.time_entries;
create policy "Time entries insert policy" on public.time_entries
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Time entries update policy" on public.time_entries;
create policy "Time entries update policy" on public.time_entries
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Time entries delete policy" on public.time_entries;
create policy "Time entries delete policy" on public.time_entries
  for delete using (auth.uid() = user_id or public.is_admin());


-- 6. ASSISTENTER / MEDHJÆLPERE (Uden eget login - administreres af f.eks. Emma)
-- ------------------------------------------------------------
create table if not exists public.assistants (
  id uuid default gen_random_uuid() primary key,
  manager_id uuid references public.profiles(id) on delete cascade not null,
  full_name text not null,
  created_at timestamptz default now()
);

-- Tilføj assistant_id og worker_name kolonner på time_entries
alter table public.time_entries add column if not exists assistant_id uuid references public.assistants(id) on delete cascade;
alter table public.time_entries add column if not exists worker_name text;

-- Indeksering
create index if not exists idx_assistants_manager on public.assistants(manager_id);
create index if not exists idx_time_entries_assistant on public.time_entries(assistant_id);

-- Row Level Security (RLS) for assistants
alter table public.assistants enable row level security;

drop policy if exists "Assistants select policy" on public.assistants;
create policy "Assistants select policy" on public.assistants
  for select using (auth.uid() = manager_id or public.is_admin());

drop policy if exists "Assistants insert policy" on public.assistants;
create policy "Assistants insert policy" on public.assistants
  for insert with check (auth.uid() = manager_id or public.is_admin());

drop policy if exists "Assistants update policy" on public.assistants;
create policy "Assistants update policy" on public.assistants
  for update using (auth.uid() = manager_id or public.is_admin());

drop policy if exists "Assistants delete policy" on public.assistants;
create policy "Assistants delete policy" on public.assistants
  for delete using (auth.uid() = manager_id or public.is_admin());

-- Rettigheder til Supabase API
grant all on public.assistants to authenticated, anon;
grant all on public.time_entries to authenticated, anon;
grant all on public.profiles to authenticated, anon;

