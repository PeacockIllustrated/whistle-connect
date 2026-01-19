Whistle Connect - Project Context + Change Plan (Prompt Companion Document)
Purpose

This document combines:

the current Whistle Connect project context (stack, routes, schema, workflows)

the compiled UI/UX and workflow changes

a phased implementation plan designed for Antigravity to execute safely and incrementally

Use this as the "source of truth" alongside your phased Antigravity prompts.

1) Project Overview

Whistle Connect is a web application connecting grassroots football coaches with qualified referees. It streamlines booking officials for matches, managing referee availability, and in-app communication.

Current status: "Now Live in Your Area" (MVP / early stage)

Audience:

Coaches (bookers)

Referees (service providers)

2) Technology Stack

Framework: Next.js 16.1.1 (App Router)

Language: TypeScript 5

Styling: Tailwind CSS 4 + PostCSS

Backend: Supabase (PostgreSQL, Auth, Realtime)

Libraries:

@supabase/supabase-js, @supabase/ssr

clsx, tailwind-merge

lucide-react (likely)

3) Project Structure and Key Routes
Core directories

src/app - App Router pages/layouts

src/components - UI + business components

components/ui - atomic reusable components (Button, Input, etc.)

components/app - business components (BookingCard, AvailabilityGrid, etc.)

src/lib - utilities and types (types.ts)

supabase/ - migrations and config

Routes

Public:

/ - landing page (hero, features, role selection)

/auth/login - sign-in

/auth/register - registration (supports ?role=coach|referee)

Authenticated:

/app/bookings - booking management

/app/availability - referee availability

/app/messages - chat threads

/app/profile - profile settings

/app/admin - admin dashboard

4) Database Schema (inferred)
Users and profiles

Profile

id, role: coach|referee|admin, full_name, phone, postcode

RefereeProfile

fa_id, level, travel_radius_km, verified, dbs_status, safeguarding_status

Club

owner_id, name, home_postcode, ground_name

Booking and matching

Booking

coach_id, status, match_date, kickoff_time, location_postcode, format, competition_type, referee_level_required

Status lifecycle

draft -> pending -> offered -> confirmed -> completed / cancelled

RefereeAvailability

day_of_week, start_time, end_time

BookingOffer

status: sent|accepted|declined|withdrawn

BookingAssignment

final link booking -> referee

Communication

Thread (linked to booking_id)

Message (kind: user|system)

5) Environment Variables

Required in .env.local:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY (optional, server-side only)

6) Compiled Change List (UI, UX, Workflow)
Global changes
Colour system (replace green)

Primary brand: #2a285e (Blue)

Referee blue (segmented controls): #1d2557

Coach red: #cd1719

Bottom navigation

Keep 4 icons

Refresh icon style while preserving 4-item structure

Contact protection (platform safety)

Block contact details that enable off-platform contact (phone, email, external links)

Enforce in UI rendering and validation where practical

7) Phased Implementation Plan (Antigravity-ready)
Phase 1 - Branding + Landing cleanup (low risk, high clarity)

Landing /

Replace CTAs:

"I’m a Referee" -> "Register as a Referee" (to referee register) - button #cd1719

"Get Started" -> "Register as a Coach" (to coach register) - button #2a285e

"Book Securley" -> "Central Venue Referees" (to sign in) - button #2a285e

Remove:

Quick Access Buttons (both)

"New to App"

Add logo top left

Auth UI

/auth/login and /auth/register

Replace green with #2a285e

Role selector becomes full block colour with white text:

Referee: #1d2557 (or #2a285e on referee register as specified)

Coach: #cd1719

Definition of Done

No green remains in primary UI surfaces

Landing has 3 clear CTAs, no quick access section, logo present

Auth screens match colour rules exactly

Phase 2 - Referee availability upgrade (core utility)

/app/availability (or referee home if availability is there)

Remove component library section

Availability time bands:

9:00-11:00

11:00-1:00

1:00-3:00

3:00-5:00

Add 5:00-7:00

Add 7:00-9:00

Add checkbox:

"Available for Central Venue booking"

Calendar:

keep tick-style weekly layout

add dates

ensure weekly format works

Definition of Done

Referee can save weekly availability using new time bands

Central venue opt-in persists

Calendar shows weekly view with dates and usable interaction

Phase 3 - Coach booking inputs + referee search results

/app/bookings (create flow)

Remove component library at bottom of page

"Book a Referee" form must include dropdowns:

County

Date

Time

Age Group

Format

Competition Type

After submit:

show referee results list matching criteria and required attributes

each result opens referee profile and has Book action

include "Back to Search"

Definition of Done

Coach can complete search and see results

Coach can open referee profile from results

Contact details are not visible anywhere in this flow

Booking initiation starts a chat thread (or creates one) immediately

Phase 4 - Booking acceptance triggers messaging

Bookings

When an offer is accepted, conversation must begin with the coach (thread created if missing, opened if exists)

Messages

Confirm end-to-end: both parties can message reliably for the booking context

Definition of Done

Accepting an offer always creates or opens the correct chat thread for both parties

Thread is linked to booking and shows the right participants

Phase 5 - Profile editing + polish

/app/profile

Remove Appearances and Component Library

Add profile editing (edit tab)

Add profile picture upload for both roles

Definition of Done

Coach and referee can edit profile fields + upload image

Removed sections are gone for both roles

8) Open Decisions (do not block early phases)

Bottom nav icon style: choose a consistent icon set and apply across all four items

"Recent Bookings" behaviour: confirm whether it shows pending, accepted, or both

9) Antigravity Guardrails (to keep execution safe)

One phase per prompt (do not combine phases)

No breaking schema changes unless explicitly requested

No new dependencies unless necessary and mainstream

Do not expose contact details (UI + validation)

Prefer incremental refactors over large rewrites

Maintain existing route structure and auth boundaries (/ public, /app/* protected)