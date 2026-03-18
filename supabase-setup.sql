-- ============================================================
-- LIGHT MY CANDLE — Supabase Database Setup
-- ============================================================
-- Run this in your Supabase Dashboard → SQL Editor
-- It creates all tables, security policies, and a trigger
-- for auto-creating user profiles on signup.
-- ============================================================

-- 1. PROFILES TABLE
-- Stores display names for users. Auto-created when someone signs up.
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  created_at timestamptz default now()
);

-- 2. PARTNERSHIPS TABLE  
-- Links two users together. user1 creates the pair, user2 joins.
-- pair_code is the 6-char code shared between partners.
create table public.partnerships (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade,
  pair_code text unique not null,
  created_at timestamptz default now()
);

-- 3. CANDLE STATUS TABLE
-- Each user in a partnership has one row here.
-- is_lit = whether their candle is currently on.
-- lit_at = when it was last lit (null if unlit).
create table public.candle_status (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  partnership_id uuid references public.partnerships(id) on delete cascade not null,
  is_lit boolean default false,
  lit_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- These policies ensure users can only access their own data
-- and their partner's candle status. Without RLS, any logged-in
-- user could read/write anyone's data.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.partnerships enable row level security;
alter table public.candle_status enable row level security;

-- Profiles: users can read any profile (needed to see partner names)
-- but only update their own.
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Partnerships: users can see/create/update partnerships they're part of.
create policy "Users can view own partnerships"
  on public.partnerships for select
  to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

create policy "Users can create partnerships"
  on public.partnerships for insert
  to authenticated
  with check (user1_id = auth.uid());

-- Allow joining a partnership (setting user2_id) — 
-- the joining user must be the one making the request
create policy "Users can join partnerships"
  on public.partnerships for update
  to authenticated
  using (true);

create policy "Users can delete own partnerships"
  on public.partnerships for delete
  to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

-- Also allow selecting partnerships by pair_code for joining
-- (user2 needs to find the partnership before they're part of it)
create policy "Users can find partnerships by code"
  on public.partnerships for select
  to authenticated
  using (true);

-- Candle status: users can see candles in their partnership,
-- and update any candle in their partnership (to blow out partner's).
create policy "Users can view candles in their partnership"
  on public.candle_status for select
  to authenticated
  using (
    partnership_id in (
      select id from public.partnerships
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Users can create own candle"
  on public.candle_status for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update candles in their partnership"
  on public.candle_status for update
  to authenticated
  using (
    partnership_id in (
      select id from public.partnerships
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Users can delete candles in their partnership"
  on public.candle_status for delete
  to authenticated
  using (
    partnership_id in (
      select id from public.partnerships
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- This trigger runs whenever a new user is created in Supabase Auth.
-- It pulls the display_name from the user's metadata and creates
-- a matching row in the profiles table.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'User'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ENABLE REALTIME
-- This tells Supabase to broadcast changes to the candle_status
-- table over WebSockets. Without this, the real-time subscription
-- in CandleContext.tsx won't receive updates.
-- ============================================================

alter publication supabase_realtime add table public.candle_status;

-- ============================================================
-- ENABLE REALTIME
-- Restrict data sets to one partnership per user.
-- ============================================================

CREATE UNIQUE INDEX one_partnership_per_user ON partnerships (user1_id) WHERE user2_id IS NOT NULL;
CREATE UNIQUE INDEX one_partnership_per_user2 ON partnerships (user2_id) WHERE user2_id IS NOT NULL;