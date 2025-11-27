import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
// import { createInsertSchema } from "drizzle-zod";
// import * as z from "zod";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    role: text("role", { enum: ["referee", "coach", "admin"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

export const profilesReferee = pgTable("profiles_referee", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    faNumber: text("fa_number").notNull(),
    level: text("level").notNull(),
    county: text("county").notNull(),
    verificationStatus: text("verification_status", { enum: ["pending", "verified", "rejected"] }).default("pending"),
    // Gamification Stats
    matchesOfficiated: integer("matches_officiated").default(0),
    consecutiveBookings: integer("consecutive_bookings").default(0),
});

export const achievements = pgTable("achievements", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // e.g., 'iron_man'
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(), // Lucide icon name
    xp: integer("xp").notNull(),
});

export const userAchievements = pgTable("user_achievements", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    achievementId: integer("achievement_id").references(() => achievements.id).notNull(),
    unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export const matches = pgTable("matches", {
    id: serial("id").primaryKey(),
    coachId: integer("coach_id").references(() => users.id).notNull(),
    refereeId: integer("referee_id").references(() => users.id).notNull(),
    date: timestamp("date").notNull(),
    location: text("location").notNull(),
    status: text("status", { enum: ["pending", "confirmed", "completed", "cancelled"] }).default("pending"),
    ageGroup: text("age_group"),
});
