-- Migration: 0004_central_venue_opt_in.sql
-- Add central_venue_opt_in to referee_profiles

ALTER TABLE referee_profiles 
ADD COLUMN central_venue_opt_in BOOLEAN DEFAULT false NOT NULL;
