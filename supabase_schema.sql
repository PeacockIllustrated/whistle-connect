-- Enable UUID generation
create extension if not exists "pgcrypto";

------------------------------------------------------------
-- 1. DROPS (CAUTION: This will wipe data)
-- Wipes the database to start fresh.
------------------------------------------------------------
drop table if exists public.user_badges cascade;
drop table if exists public.badges cascade;
drop table if exists public.referee_reflections cascade;
drop table if exists public.tournament_matches cascade;
drop table if exists public.tournaments cascade;
drop table if exists public.user_training_progress cascade;
drop table if exists public.training_modules cascade;
drop table if exists public.referee_ratings cascade;
drop table if exists public.referee_assignments cascade;
drop table if exists public.matches cascade;
drop table if exists public.profiles cascade;
drop table if exists public.clubs cascade;
drop table if exists public.seasons cascade;
drop table if exists public.counties cascade;
drop table if exists public.achievements cascade; -- Legacy
drop table if exists public.user_achievements cascade; -- Legacy
drop table if exists public.profiles_referee cascade; -- Legacy
drop table if exists public.users cascade; -- Legacy

------------------------------------------------------------
-- 2. SUPPORTING TABLES: COUNTIES, SEASONS, CLUBS
------------------------------------------------------------

create table if not exists public.counties (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  fa_code      text,           -- e.g. "NFA"
  created_at   timestamptz not null default now()
);

create table if not exists public.seasons (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,  -- e.g. '2025/26'
  start_date   date not null,
  end_date     date not null,
  created_at   timestamptz not null default now(),
  constraint seasons_name_unique unique (name)
);

create table if not exists public.clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  county_id    uuid references public.counties (id) on delete set null,
  created_at   timestamptz not null default now()
);

------------------------------------------------------------
-- 3. PROFILES (UNIFIED USER TABLE)
-- Replaces 'users' and 'profiles_referee'
------------------------------------------------------------

create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text, -- Optional, for convenience, but auth.users is source of truth
  role                  text not null check (role in ('referee', 'coach', 'admin')),
  display_name          text,
  
  -- Referee Specific Fields
  fa_number             text,
  county_id             uuid references public.counties (id) on delete set null,
  county_text           text, -- Temporary storage for signup input
  level                 text, -- e.g. 'Level 7'
  verification_status   text check (verification_status in ('pending', 'verified', 'rejected')) default 'pending',
  
  -- Location
  home_postcode         text,
  home_location_lat     double precision,
  home_location_lng     double precision,
  
  -- Gamification Stats (Cached)
  matches_officiated    integer default 0,
  consecutive_bookings  integer default 0,
  
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_county_id on public.profiles (county_id);

------------------------------------------------------------
-- 4. MATCHES
------------------------------------------------------------

create table if not exists public.matches (
  id                    uuid primary key default gen_random_uuid(),
  season_id             uuid references public.seasons (id) on delete set null,
  home_club_id          uuid references public.clubs (id) on delete set null,
  away_club_id          uuid references public.clubs (id) on delete set null,
  
  -- If a coach created the request (Open Request)
  created_by_coach_id   uuid references public.profiles (id) on delete set null,
  
  kickoff_at            timestamptz not null,
  match_location_lat    double precision,
  match_location_lng    double precision,
  match_postcode        text,
  match_town            text,
  county_id             uuid references public.counties (id) on delete set null,
  
  age_group             text, -- e.g. 'U14'
  fee                   text, -- e.g. '£40'
  
  status                text check (status in ('pending', 'confirmed', 'completed', 'cancelled')) default 'pending',
  
  created_at            timestamptz not null default now()
);

create index if not exists idx_matches_season_id on public.matches (season_id);
create index if not exists idx_matches_county_id on public.matches (county_id);
create index if not exists idx_matches_kickoff_at on public.matches (kickoff_at);

------------------------------------------------------------
-- 5. REFEREE ASSIGNMENTS
------------------------------------------------------------

create table if not exists public.referee_assignments (
  id                       uuid primary key default gen_random_uuid(),
  referee_id               uuid not null references public.profiles (id) on delete cascade,
  match_id                 uuid not null references public.matches (id) on delete cascade,

  invited_at               timestamptz not null default now(),
  accepted_at              timestamptz,
  declined_at              timestamptz,
  cancelled_at             timestamptz,
  cancelled_by             text check (cancelled_by in ('referee', 'coach', 'system')),
  status                   text not null check (
                              status in (
                                'invited',
                                'accepted',
                                'completed',
                                'cancelled',
                                'no_show',
                                'expired'
                              )
                            ),

  check_in_at              timestamptz,
  check_out_at             timestamptz,
  assignment_distance_km   numeric(8, 2),

  created_at               timestamptz not null default now()
);

create index if not exists idx_ref_assignments_referee_id on public.referee_assignments (referee_id);
create index if not exists idx_ref_assignments_match_id on public.referee_assignments (match_id);

------------------------------------------------------------
-- 6. RATINGS & REFLECTIONS
------------------------------------------------------------

create table if not exists public.referee_ratings (
  id                       uuid primary key default gen_random_uuid(),
  referee_id               uuid not null references public.profiles (id) on delete cascade,
  match_id                 uuid not null references public.matches (id) on delete cascade,
  rated_by_coach_id        uuid not null references public.profiles (id) on delete cascade,

  professionalism_rating   integer not null check (professionalism_rating between 1 and 5),
  communication_rating     integer not null check (communication_rating between 1 and 5),
  punctuality_rating       integer not null check (punctuality_rating between 1 and 5),

  comment                  text,
  created_at               timestamptz not null default now(),

  constraint referee_ratings_one_per_coach_per_match unique (referee_id, match_id, rated_by_coach_id)
);

create table if not exists public.referee_reflections (
  id            uuid primary key default gen_random_uuid(),
  referee_id    uuid not null references public.profiles (id) on delete cascade,
  match_id      uuid not null references public.matches (id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  content       text not null
);

------------------------------------------------------------
-- 7. TRAINING & TOURNAMENTS
------------------------------------------------------------

create table if not exists public.training_modules (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,
  is_active    boolean not null default true,
  sort_order   integer,
  created_at   timestamptz not null default now()
);

create table if not exists public.user_training_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  module_id    uuid not null references public.training_modules (id) on delete cascade,
  completed_at timestamptz not null default now(),
  constraint user_training_progress_unique unique (user_id, module_id)
);

create table if not exists public.tournaments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  start_date          date not null,
  end_date            date not null,
  is_full_day         boolean not null default false,
  location_postcode   text,
  created_at          timestamptz not null default now()
);

create table if not exists public.tournament_matches (
  tournament_id       uuid not null references public.tournaments (id) on delete cascade,
  match_id            uuid not null references public.matches (id) on delete cascade,
  primary key (tournament_id, match_id)
);

------------------------------------------------------------
-- 8. BADGES (GAMIFICATION)
------------------------------------------------------------

create table if not exists public.badges (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,   -- e.g. 'ROAD_WARRIOR'
  name            text not null,
  description     text,
  icon            text,                   -- Lucide icon name or emoji
  xp              integer default 0,      -- Added to keep compatibility with previous design
  applies_to_role text not null check (applies_to_role in ('referee', 'coach', 'both')) default 'referee',
  created_at      timestamptz not null default now()
);

create table if not exists public.user_badges (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  badge_id        uuid not null references public.badges (id) on delete cascade,
  awarded_at      timestamptz not null default now(),
  awarded_by      text,
  season_id       uuid references public.seasons (id) on delete set null,
  metadata        jsonb,
  constraint user_badges_unique_per_season unique (user_id, badge_id, season_id)
);

------------------------------------------------------------
-- 9. SEED DATA: BADGES
------------------------------------------------------------

insert into public.badges (code, name, description, icon, xp, applies_to_role) values
('road_warrior', 'Road Warrior', 'Logged 200+ miles of travel for fixtures.', 'Footprints', 200, 'referee'),
('iron_track', 'Iron Track (Reliability Elite)', 'Completed 10 consecutive confirmed appointments with zero cancellations.', 'ShieldCheck', 500, 'referee'),
('early_bird', 'Early Bird', 'Checked in early for 20 matches.', 'Sunrise', 150, 'referee'),
('top_rated_pro', 'Top Rated Professional', 'Maintained excellent post-match professionalism ratings across 25 matches.', 'Star', 300, 'referee'),
('fixture_machine', 'Fixture Machine', 'Reached 50 completed appointments in a season.', 'Cog', 400, 'referee'),
('local_legend', 'Local Legend', 'Completed 30 or more matches inside your registered county.', 'MapPin', 250, 'referee'),
('mile_marker', 'Mile Marker', 'Completed 100 total verified match check-ins.', 'Milestone', 500, 'referee'),
('whistle_scholar', 'Whistle Scholar', 'Completed all in-app training modules.', 'GraduationCap', 300, 'referee'),
('community_champ', 'Community Champ', 'Officiated for 10 different clubs across the platform.', 'Users', 200, 'referee'),
('tournament_titan', 'Tournament Titan', 'Participated in at least 3 full-day tournament events.', 'Trophy', 400, 'referee'),
('seasoned_traveller', 'Seasoned Traveller', 'Officiated matches in 5+ different towns or postcodes.', 'Compass', 200, 'referee'),
('consistency_king', 'Consistency King', 'Maintained over 90% appointment acceptance rate across a season.', 'Crown', 350, 'referee'),
('rapid_responder', 'Rapid Responder', 'Accepted 20 match invitations within 10 minutes of being sent.', 'Zap', 150, 'referee'),
('mentor_mode', 'Mentor Mode', 'Submitted 5+ post-match self-assessments or learning reflections.', 'BookOpen', 200, 'referee'),
('golden_whistle', 'Golden Whistle', 'Season-long achievement for outstanding reliability and engagement.', 'Sparkles', 1000, 'referee'),
('iron_man', 'Iron Man', 'Completed 5 consecutive bookings without cancellation', 'Shield', 500, 'referee'),
('century_club', 'Century Club', 'Officiated 100 matches', 'Award', 1000, 'referee')
on conflict (code) do update set 
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  xp = excluded.xp;
