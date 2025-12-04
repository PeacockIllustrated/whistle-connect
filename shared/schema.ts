import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, doublePrecision, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 1. Supporting Tables
export const counties = pgTable("counties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  faCode: text("fa_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  countyId: uuid("county_id").references(() => counties.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Profiles (Unified User Table)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // References auth.users
  email: text("email"),
  role: text("role", { enum: ["referee", "coach", "admin"] }).notNull(),
  displayName: text("display_name"),

  // Referee Specific
  faNumber: text("fa_number"),
  countyId: uuid("county_id").references(() => counties.id),
  countyText: text("county_text"), // Temporary storage for signup input
  level: text("level"),
  verificationStatus: text("verification_status", { enum: ["pending", "verified", "rejected"] }).default("pending"),

  // Location
  homePostcode: text("home_postcode"),
  homeLocationLat: doublePrecision("home_location_lat"),
  homeLocationLng: doublePrecision("home_location_lng"),

  // Stats
  matchesOfficiated: integer("matches_officiated").default(0),
  consecutiveBookings: integer("consecutive_bookings").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. Matches
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").references(() => seasons.id),
  homeClubId: uuid("home_club_id").references(() => clubs.id),
  awayClubId: uuid("away_club_id").references(() => clubs.id),
  createdByCoachId: uuid("created_by_coach_id").references(() => profiles.id),

  kickoffAt: timestamp("kickoff_at").notNull(),
  matchLocationLat: doublePrecision("match_location_lat"),
  matchLocationLng: doublePrecision("match_location_lng"),
  matchPostcode: text("match_postcode"),
  matchTown: text("match_town"),
  countyId: uuid("county_id").references(() => counties.id),

  ageGroup: text("age_group"),
  fee: text("fee"),

  status: text("status", { enum: ["pending", "confirmed", "completed", "cancelled"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Referee Assignments
export const refereeAssignments = pgTable("referee_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  refereeId: uuid("referee_id").references(() => profiles.id).notNull(),
  matchId: uuid("match_id").references(() => matches.id).notNull(),

  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: text("cancelled_by", { enum: ["referee", "coach", "system"] }),

  status: text("status", {
    enum: ["invited", "accepted", "completed", "cancelled", "no_show", "expired"]
  }).notNull(),

  checkInAt: timestamp("check_in_at"),
  checkOutAt: timestamp("check_out_at"),
  assignmentDistanceKm: numeric("assignment_distance_km"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Badges
export const badges = pgTable("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  xp: integer("xp").default(0),
  appliesToRole: text("applies_to_role", { enum: ["referee", "coach", "both"] }).default("referee").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userBadges = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id).notNull(),
  badgeId: uuid("badge_id").references(() => badges.id).notNull(),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  seasonId: uuid("season_id").references(() => seasons.id),
  metadata: jsonb("metadata"),
});

// Export Zod Schemas
export const insertProfileSchema = createInsertSchema(profiles);
export const insertMatchSchema = createInsertSchema(matches);
export const insertBadgeSchema = createInsertSchema(badges);
export const insertRefereeAssignmentSchema = createInsertSchema(refereeAssignments);
