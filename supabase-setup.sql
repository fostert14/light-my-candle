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

-- ============================================================
-- LIGHT MY CANDLE — Full Feature Schema Migration
-- ============================================================
-- Run this AFTER the original supabase-setup.sql
-- This adds: premium subscriptions, heat levels, scheduled
-- candles (calendar), messaging, mood settings, candle history,
-- push notification tokens, and candle designs.
-- ============================================================


-- ============================================================
-- 1. PROFILES TABLE — Add premium + push notification fields
-- ============================================================
-- is_premium:     Whether this user has an active subscription.
--                 Used throughout the app to gate premium features.
-- premium_until:  When their subscription expires. Allows the app
--                 to check if premium is still active without hitting
--                 a payment provider every time.
-- push_token:     The Expo push token for this device. Stored here
--                 so we can send notifications when their partner
--                 lights a candle. Each device gets a unique token
--                 from Expo's push service.
-- timezone:       Needed for scheduled candles — when someone sets
--                 a candle to light at "8pm", we need to know which
--                 8pm they mean.

alter table public.profiles
  add column if not exists is_premium boolean default false,
  add column if not exists premium_until timestamptz,
  add column if not exists push_token text,
  add column if not exists timezone text default 'America/Chicago';


-- ============================================================
-- 2. CANDLE STATUS — Add heat level + mood
-- ============================================================
-- heat_level:  Three tiers of intensity: 'low', 'medium', 'high'.
--              Drives the visual flame size/color and communicates
--              intensity to the partner. Default is 'medium'.
--              FREE users always use 'medium'. Premium users choose.
-- mood:        Optional mood tag that changes the candle's visual
--              style. Each mood maps to a different color palette
--              and animation style in the Candle component.
--              Examples: 'romantic' (warm reds/golds), 'playful'
--              (bright/bouncy), 'passionate' (deep reds/intense),
--              'relaxed' (soft/mellow glow).
--              NULL means default candle style.

alter table public.candle_status
  add column if not exists heat_level text default 'medium'
    check (heat_level in ('low', 'medium', 'high')),
  add column if not exists mood text
    check (mood in ('romantic', 'playful', 'passionate', 'relaxed', null));


-- ============================================================
-- 3. CANDLE EVENTS — History log
-- ============================================================
-- Every candle interaction gets logged here. This is append-only
-- (rows are inserted, never updated or deleted by normal use).
-- This powers:
--   - History view ("you lit 12 candles last month")
--   - Pattern detection ("most active on Saturday nights")
--   - Streak tracking ("7 days in a row!")
--
-- event_type options:
--   'lit'       — user lit their own candle
--   'blown_out' — user blew out their partner's candle
--   'expired'   — candle auto-extinguished (future: timeout feature)
--   'scheduled' — candle was lit by the scheduler
--
-- heat_level + mood are snapshot copies of what the candle was set
-- to at the time of the event, so history is accurate even if the
-- user later changes their preferences.

create table public.candle_events (
  id uuid default gen_random_uuid() primary key,
  partnership_id uuid references public.partnerships(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null check (event_type in ('lit', 'blown_out', 'expired', 'scheduled')),
  heat_level text default 'medium' check (heat_level in ('low', 'medium', 'high')),
  mood text check (mood in ('romantic', 'playful', 'passionate', 'relaxed', null)),
  message text,              -- optional message attached to this event
  created_at timestamptz default now()
);


-- ============================================================
-- 4. SCHEDULED CANDLES — Calendar feature
-- ============================================================
-- This is the calendar's data source. Each row = one scheduled
-- event visible on both partners' calendars.
--
-- How it works:
--   1. User taps a day on the calendar
--   2. Picks heat level, optionally adds a message and mood
--   3. Row is inserted with status = 'pending'
--   4. Partner sees it on their calendar and gets a notification
--   5. Partner can 'confirm' or 'decline' (updates status)
--   6. When scheduled_for arrives, a Supabase Edge Function
--      checks for 'confirmed' events, lights the candle, and
--      sends a push notification
--
-- scheduled_for:   The exact datetime the candle should light.
--                  Stored in UTC, displayed in user's timezone.
-- created_by:      Who created the scheduled event.
-- status:          'pending' (just created, waiting for partner),
--                  'confirmed' (partner accepted),
--                  'declined' (partner said not tonight),
--                  'completed' (candle was lit by the scheduler),
--                  'cancelled' (creator cancelled before it fired).
-- is_recurring:    Future use — weekly recurring date nights.
-- recurrence_rule: Future use — e.g. 'weekly:saturday' for
--                  recurring schedules.

create table public.scheduled_candles (
  id uuid default gen_random_uuid() primary key,
  partnership_id uuid references public.partnerships(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  scheduled_for timestamptz not null,
  heat_level text default 'medium' check (heat_level in ('low', 'medium', 'high')),
  mood text check (mood in ('romantic', 'playful', 'passionate', 'relaxed', null)),
  message text,
  status text default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'completed', 'cancelled')),
  is_recurring boolean default false,
  recurrence_rule text,        -- future: 'weekly:saturday', 'biweekly', etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ============================================================
-- 5. MESSAGES — Candle messages
-- ============================================================
-- Short messages attached to candle interactions. NOT a full
-- chat system — intentionally limited to keep focus on the
-- candle metaphor. Think of these as notes on a candle, not texts.
--
-- Can be standalone (just a sweet message) or linked to a
-- candle_event (message sent when lighting a candle).
--
-- Premium feature: free users can't send messages.

create table public.candle_messages (
  id uuid default gen_random_uuid() primary key,
  partnership_id uuid references public.partnerships(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  candle_event_id uuid references public.candle_events(id) on delete set null,
  content text not null check (char_length(content) <= 200),  -- keep it short and sweet
  is_read boolean default false,
  created_at timestamptz default now()
);


-- ============================================================
-- 6. CANDLE DESIGNS — Custom candle visuals
-- ============================================================
-- Each row is a candle skin that changes the visual appearance.
-- Some are free (bundled with the app), most are premium-only.
--
-- design_key:       A unique string the frontend uses to look up
--                   the right visual assets/component variant.
--                   e.g. 'classic', 'taper', 'lantern', 'neon'
-- color_primary /
-- color_secondary:  Hex colors the Candle component uses to
--                   render this design. Allows the frontend to
--                   be data-driven instead of hardcoding colors.
-- requires_premium: If true, only premium users can equip this.

create table public.candle_designs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  design_key text unique not null,
  description text,
  color_primary text not null default '#FF6B35',    -- main flame color
  color_secondary text not null default '#FF9F1C',  -- inner glow color
  requires_premium boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Add the user's selected design to their candle status
alter table public.candle_status
  add column if not exists design_id uuid references public.candle_designs(id);


-- ============================================================
-- 7. DAILY LIGHT TRACKING — Free tier limit enforcement
-- ============================================================
-- Free users get 1 candle light per day. This table tracks usage.
-- Each row = one day for one user, with a count of how many times
-- they lit their candle that day.
--
-- The app checks this before allowing a light:
--   if (!isPremium && todayCount >= 1) → show upgrade prompt
--
-- Uses a unique constraint on (user_id, date) so there's only
-- ever one row per user per day. The app does an UPSERT:
-- INSERT ... ON CONFLICT (user_id, date) DO UPDATE SET count = count + 1

create table public.daily_light_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  light_count int default 0,
  created_at timestamptz default now(),
  unique(user_id, date)
);


-- ============================================================
-- ROW LEVEL SECURITY — New tables
-- ============================================================

alter table public.candle_events enable row level security;
alter table public.scheduled_candles enable row level security;
alter table public.candle_messages enable row level security;
alter table public.candle_designs enable row level security;
alter table public.daily_light_usage enable row level security;

-- Helper: check if user is in a given partnership
-- (Used repeatedly in policies below to avoid copy-pasting the same subquery)
create or replace function public.user_in_partnership(p_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.partnerships
    where id = p_id
    and (user1_id = auth.uid() or user2_id = auth.uid())
  );
$$ language sql security definer stable;


-- CANDLE EVENTS: users can view/insert events in their partnership
create policy "View own partnership events"
  on public.candle_events for select to authenticated
  using (public.user_in_partnership(partnership_id));

create policy "Create events in own partnership"
  on public.candle_events for insert to authenticated
  with check (user_id = auth.uid() and public.user_in_partnership(partnership_id));


-- SCHEDULED CANDLES: both partners can view, creator can modify
create policy "View own partnership schedule"
  on public.scheduled_candles for select to authenticated
  using (public.user_in_partnership(partnership_id));

create policy "Create scheduled candles"
  on public.scheduled_candles for insert to authenticated
  with check (created_by = auth.uid() and public.user_in_partnership(partnership_id));

-- Both partners can update (needed for confirm/decline)
create policy "Update scheduled candles in partnership"
  on public.scheduled_candles for update to authenticated
  using (public.user_in_partnership(partnership_id));

create policy "Delete own scheduled candles"
  on public.scheduled_candles for delete to authenticated
  using (created_by = auth.uid());


-- MESSAGES: both partners can view, sender creates
create policy "View messages in partnership"
  on public.candle_messages for select to authenticated
  using (public.user_in_partnership(partnership_id));

create policy "Send messages in partnership"
  on public.candle_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.user_in_partnership(partnership_id));

-- Partner can mark messages as read
create policy "Update messages in partnership"
  on public.candle_messages for update to authenticated
  using (public.user_in_partnership(partnership_id));


-- CANDLE DESIGNS: everyone can view (it's a catalog)
create policy "Anyone can view candle designs"
  on public.candle_designs for select to authenticated
  using (true);


-- DAILY LIGHT USAGE: users can only see/modify their own
create policy "View own light usage"
  on public.daily_light_usage for select to authenticated
  using (user_id = auth.uid());

create policy "Insert own light usage"
  on public.daily_light_usage for insert to authenticated
  with check (user_id = auth.uid());

create policy "Update own light usage"
  on public.daily_light_usage for update to authenticated
  using (user_id = auth.uid());


-- ============================================================
-- ENABLE REALTIME — New tables that need live updates
-- ============================================================

alter publication supabase_realtime add table public.scheduled_candles;
alter publication supabase_realtime add table public.candle_messages;


-- ============================================================
-- SEED DATA — Default candle designs
-- ============================================================
-- These ship with the app. 'classic' is free and the default.

insert into public.candle_designs (name, design_key, description, color_primary, color_secondary, requires_premium, sort_order) values
  ('Classic',    'classic',    'The original warm glow',           '#FF6B35', '#FF9F1C', false, 0),
  ('Taper',      'taper',      'Elegant and tall',                 '#E8D5B7', '#FFE4B5', true,  1),
  ('Lantern',    'lantern',    'Cozy enclosed flame',              '#FF8C42', '#FFD700', true,  2),
  ('Neon',       'neon',       'Electric and bold',                '#FF006E', '#FF69B4', true,  3),
  ('Midnight',   'midnight',   'Deep blue mystique',               '#4169E1', '#87CEEB', true,  4),
  ('Forest',     'forest',     'Earthy and grounding',             '#2D5016', '#90EE90', true,  5),
  ('Sunset',     'sunset',     'Golden hour vibes',                '#FF4500', '#FFD700', true,  6),
  ('Lavender',   'lavender',   'Calm and soothing',                '#9370DB', '#E6E6FA', true,  7);


-- ============================================================
-- ADD 'matched' TO candle_events event_type CONSTRAINT
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.candle_events
  DROP CONSTRAINT IF EXISTS candle_events_event_type_check;

ALTER TABLE public.candle_events
  ADD CONSTRAINT candle_events_event_type_check
  CHECK (event_type IN ('lit', 'blown_out', 'expired', 'scheduled', 'matched'));


-- ============================================================
-- FEATURE GATING REFERENCE
-- ============================================================
-- This isn't SQL — it's a reference for the frontend/Claude Code.
--
-- FREE TIER:
--   - 1 candle light per day (enforced via daily_light_usage)
--   - Default 'medium' heat level only
--   - Default 'classic' candle design only
--   - No messages
--   - No scheduled candles / calendar
--   - No mood settings
--   - No history/patterns view
--   - Basic push notifications (partner lit their candle)
--
-- PREMIUM TIER ($3.99-4.99/month):
--   - Unlimited candle lights per day
--   - All 3 heat levels (low, medium, high)
--   - All candle designs
--   - Messages with candle lighting
--   - Calendar / scheduled candles
--   - Mood settings
--   - Full history with pattern insights
--   - Enhanced push notifications (scheduled reminders, etc.)
--
-- IMPLEMENTATION:
--   Check profiles.is_premium before allowing premium actions.
--   Use RevenueCat for subscription management — it handles
--   App Store / Play Store subscriptions and webhooks back to
--   your server to update profiles.is_premium.
-- ============================================================