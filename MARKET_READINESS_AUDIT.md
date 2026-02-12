# Whistle Connect — Market Readiness Audit

**Date:** 2026-02-11
**Build status at audit time:** Clean (0 TypeScript errors, all routes compile)
**Lint status at audit time:** 27 errors, 41 warnings

---

## Executive Summary

Whistle Connect is feature-complete for its MVP — booking workflow, messaging, notifications, availability management, and admin verification all work end-to-end. However, a thorough code audit identified **critical security gaps** in Row Level Security policies, **missing authorization checks** in server actions, **data integrity risks** from non-transactional multi-step mutations, and **code quality issues** across the codebase.

This document captures all findings for tracking and future reference.

---

## Critical Issues

### 1. Overly Permissive RLS INSERT Policies

**Severity:** CRITICAL
**Impact:** Any authenticated user can insert arbitrary data into 5 tables

| Table | Policy Name | Location | Problem |
|-------|------------|----------|---------|
| `booking_offers` | "System can insert offers" | `0002_rls_policies.sql:140` | `WITH CHECK (true)` — any user can create offers on any booking |
| `booking_assignments` | "System can insert assignments" | `0002_rls_policies.sql:164` | `WITH CHECK (true)` — any user can assign referees |
| `threads` | "System can insert threads" | `0002_rls_policies.sql:176` | `WITH CHECK (true)` — any user can create threads |
| `thread_participants` | "System can insert participants" | `0002_rls_policies.sql:188` | `WITH CHECK (true)` — any user can add anyone to threads |
| `user_badges` | "System can insert badges" | `0002_rls_policies.sql:220` | `WITH CHECK (true)` — any user can award themselves badges |

**Note:** These policies were NOT fixed in migration `0099_master_fixes.sql` — they were re-applied with the same `WITH CHECK (true)`.

### 2. Missing Notifications INSERT Policy

**Severity:** CRITICAL
**Location:** `supabase/migrations/0103_notifications_system.sql`
**Problem:** Only SELECT and UPDATE policies exist. No INSERT policy is defined. The `createNotification()` function in `src/lib/notifications.ts` inserts notifications for OTHER users (e.g., coach action creates notification for referee), which complicates a simple `auth.uid() = user_id` policy.

### 3. Missing Authorization in Server Actions

**Severity:** CRITICAL
**Location:** `src/app/app/bookings/actions.ts`

| Function | Line | Problem |
|----------|------|---------|
| `searchRefereesForBooking()` | 735-820 | Checks auth but never verifies `booking.coach_id === user.id` |
| `sendBookingRequest()` | 822-867 | Checks auth but never fetches/verifies booking ownership before creating offer |

Any authenticated user can search referees for and send offers on another user's booking.

---

## High Priority Issues

### 4. No Transaction Handling in `confirmPrice()`

**Severity:** HIGH
**Location:** `src/app/app/bookings/actions.ts:450-572`
**Problem:** Performs 7 sequential database mutations with no error checking between steps and no rollback:
1. Update offer status to 'accepted' (line 475)
2. Create booking_assignment (line 481)
3. Update booking status to 'confirmed' (line 489)
4. Withdraw competing offers (line 495)
5. Create/get messaging thread (line 502)
6. Add thread participants + system message (line 527)
7. Send notification + remove availability (line 546)

If any step fails after step 1, the database is left in an inconsistent state.

### 5. Profile Creation Race Condition

**Severity:** HIGH
**Location:** `src/lib/auth/actions.ts:69`
**Problem:** Uses a fixed `setTimeout(500)` to wait for the auth trigger to create a profile. If the trigger takes longer than 500ms or fails, the fallback manual creation may or may not succeed depending on whether the admin client is available.

```typescript
// Current workaround:
await new Promise(resolve => setTimeout(resolve, 500))
```

### 6. Fire-and-Forget Notification Cleanup

**Severity:** HIGH
**Location:** `src/lib/notifications.ts:69-74`
**Problem:** Uses `forEach(async ...)` which does not await the async callbacks. Invalid push subscription deletions are fire-and-forget.

```typescript
// Broken pattern:
results.forEach(async (result, index) => {
    if (result.status === 'rejected' && result.reason.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id) // Never awaited
    }
})
```

### 7. Silent Notification Failures

**Severity:** HIGH
**Location:** `src/lib/notifications.ts:15-29`
**Problem:** `createNotification()` returns `void`. Errors are logged but never propagated to callers. Used in critical flows like booking confirmation and messaging.

### 8. Inconsistent Error Handling in Profile Actions

**Severity:** HIGH
**Location:** `src/app/app/profile/actions.ts:14-15, 41-42`
**Problem:** Uses `throw new Error('Not authenticated')` for auth failures, while every other server action in the codebase returns `{ error: string }`. Client code must handle both patterns.

---

## Medium Priority Issues

### 9. Type/Schema Mismatches

**Severity:** MEDIUM
**Location:** `src/lib/types.ts`

| Line | Field | Problem |
|------|-------|---------|
| 58 | `RefereeProfile.fa_verified` | Field doesn't exist in database — computed as `!!fa_id` at runtime |
| 122 | `BookingAssignment.assigned_at` | DB column is `confirmed_at`, not `assigned_at` |
| 136 | `ThreadParticipant.joined_at` | DB column is `created_at`, not `joined_at` |
| 107-116 | `BookingOffer` | Missing `sent_at` field that exists in DB schema |
| 118-123 | `BookingAssignment` | Missing `created_at` field that exists in DB schema |

### 10. Duplicate Message Query in `getThreads()`

**Severity:** MEDIUM
**Location:** `src/app/app/messages/actions.ts:128-166`
**Problem:** Fetches ALL messages for all threads twice — once for last messages (line 130) and again for unread counts (line 148). Both datasets could be computed from a single query.

### 11. Lint Errors — 27 errors, 41 warnings

**Severity:** MEDIUM

**Error breakdown:**
- 22 `no-explicit-any` errors across 13 files
- 2 `set-state-in-effect` errors (false positives — proper React patterns)
- 3 `no-explicit-any` in catch clauses

**Warning breakdown:**
- 4 `no-img-element` — using `<img>` instead of `next/image` `<Image>`
- ~6 `no-unused-vars` — unused variables and imports
- Various other minor warnings

**Files with most `any` usage:**
- `src/app/app/page.tsx` — 6 instances
- `src/app/app/profile/ProfileClient.tsx` — 3 instances
- `src/components/app/AwaitingAction.tsx` — 2 instances
- `src/app/app/messages/[threadId]/MessageList.tsx` — 2 instances

### 12. No Error or Loading Boundaries

**Severity:** MEDIUM
**Problem:** No `error.tsx` or `loading.tsx` files exist anywhere in the route tree. Unhandled errors show a blank page. Route transitions have no loading feedback.

---

## Low Priority / Future Considerations

### 13. No Input Validation on Server Actions

Server actions accept data without validation. No schema validation (e.g., Zod) is used. Booking form data, profile updates, and messages are inserted as-received.

### 14. No Rate Limiting

No protection against rapid booking creation, offer spamming, or message flooding.

### 15. Hard Deletes Only

`deleteBooking()` performs hard deletes with no recovery option. Consider soft deletes for production.

### 16. No Pagination on List Queries

Booking lists, message lists, and thread lists fetch all records without limits or cursor-based pagination.

### 17. No Audit Logging

No record of who created/modified/deleted bookings, offers, or assignments.

### 18. Middleware Deprecation Warning

Next.js 16 emits a warning: `The "middleware" file convention is deprecated. Please use "proxy" instead.` Current middleware at `src/middleware.ts` works but should be migrated for future compatibility.

---

## Existing Security Strengths

- RLS enabled on all 11 tables
- SECURITY DEFINER functions prevent RLS recursion (`check_is_booking_coach`, `check_is_booking_referee`, `is_admin`, `is_thread_participant`)
- Auth trigger with error handling and SECURITY DEFINER (`handle_new_user`)
- Proper storage bucket policies (self-only upload/delete)
- Role-based UI gating (coach/referee/admin)
- Supabase Realtime enabled safely for messages and notifications
- Session refresh middleware on all requests

---

## Available Helper Functions (for reference)

Defined in migrations `0001_reset_schema.sql` and `0099_master_fixes.sql`:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `check_is_booking_coach` | `(p_booking_id UUID, p_user_id UUID) → BOOLEAN` | Is user the coach of this booking? |
| `check_is_booking_referee` | `(p_booking_id UUID, p_user_id UUID) → BOOLEAN` | Does user have offer/assignment for booking? |
| `is_admin` | `(user_id UUID) → BOOLEAN` | Is user an admin? |
| `is_thread_participant` | `(p_thread_id UUID, p_user_id UUID) → BOOLEAN` | Is user in this thread? |
| `get_user_role` | `(user_id UUID) → user_role` | Get user's role enum |

All are `SECURITY DEFINER` — they bypass RLS to prevent infinite recursion in policy evaluations.

---

## Database Schema Quick Reference

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `profiles` | id, role, full_name, phone, postcode, avatar_url | Core user data |
| `referee_profiles` | profile_id, fa_id, level, county, verified, travel_radius_km, central_venue_opt_in | Extended referee data |
| `referee_availability` | referee_id, day_of_week, start_time, end_time | Weekly recurring slots |
| `referee_date_availability` | referee_id, date, start_time, end_time | Date-specific slots |
| `bookings` | coach_id, status, match_date, kickoff_time, county, booking_type | Match bookings |
| `booking_offers` | booking_id, referee_id, status, price_pence | Coach-to-referee offers |
| `booking_assignments` | booking_id, referee_id | Confirmed assignments |
| `threads` | booking_id, title | Message containers |
| `thread_participants` | thread_id, profile_id, last_read_at | Thread membership |
| `messages` | thread_id, sender_id, kind, body | Chat messages |
| `notifications` | user_id, title, message, type, link, is_read | In-app notifications |
| `push_subscriptions` | user_id, endpoint, p256dh, auth | Web Push subscriptions |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.1 |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | 4 |
| Language | TypeScript (strict) | 5.9.3 |
| Database | Supabase (PostgreSQL 17) | — |
| Auth | Supabase Auth | — |
| Real-time | Supabase Realtime | — |
| Icons | lucide-react | 0.563.0 |
| Push | web-push | 3.6.7 |
| Deployment | Vercel | — |
