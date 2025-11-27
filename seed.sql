-- Whistle Connect Database Setup & Seed
-- Run this script in the Supabase SQL Editor to reset and seed the database.

-- 1. Clean Up (Optional: Remove existing tables if you want a fresh start)
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS profiles_referee CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Schema Creation (DDL)

-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('referee', 'coach', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Referee Profiles Table
CREATE TABLE profiles_referee (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fa_number TEXT NOT NULL,
  level TEXT NOT NULL,
  county TEXT NOT NULL,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  matches_officiated INTEGER DEFAULT 0,
  consecutive_bookings INTEGER DEFAULT 0
);

-- Achievements Table
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp INTEGER NOT NULL
);

-- User Achievements Table
CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  achievement_id INTEGER NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMP DEFAULT NOW()
);

-- Matches Table
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id),
  referee_id INTEGER REFERENCES users(id), -- Nullable for open requests
  date TIMESTAMP NOT NULL,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  age_group TEXT,
  fee TEXT
);

-- 3. Seed Data

-- Users (Passwords are hashed placeholders)
INSERT INTO users (email, password, role) VALUES 
('coach@example.com', 'hashed_password_123', 'coach'),
('referee@example.com', 'hashed_password_456', 'referee');

-- Referee Profile
INSERT INTO profiles_referee (user_id, fa_number, level, county, verification_status, matches_officiated) VALUES 
(2, 'FAN123456', 'Level 7', 'London FA', 'verified', 15);

-- Achievements
INSERT INTO achievements (code, name, description, icon, xp) VALUES 
('first_whistle', 'First Whistle', 'Officiate your first match', 'whistle', 100),
('hat_trick', 'Hat Trick', 'Officiate 3 matches in a week', 'trophy', 300),
('iron_man', 'Iron Man', 'Officiate 10 matches without rejection', 'shield', 500),
('clean_sheet', 'Clean Sheet', 'No cards issued in a match', 'check-circle', 200);

-- Matches
-- Confirmed Match (Coach 1 vs Referee 2)
INSERT INTO matches (coach_id, referee_id, date, location, status, age_group, fee) VALUES 
(1, 2, NOW() + INTERVAL '2 days', 'Hackney Marshes', 'confirmed', 'U14', '£40');

-- Open Request (Coach 1, No Referee yet)
INSERT INTO matches (coach_id, referee_id, date, location, status, age_group, fee) VALUES 
(1, NULL, NOW() + INTERVAL '5 days', 'Regents Park', 'pending', 'U12', '£35');

-- Completed Match (Coach 1 vs Referee 2)
INSERT INTO matches (coach_id, referee_id, date, location, status, age_group, fee) VALUES 
(1, 2, NOW() - INTERVAL '7 days', 'Wembley Powerleague', 'completed', 'Adults', '£50');
