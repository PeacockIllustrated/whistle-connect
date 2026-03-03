# Whistle Connect — Remaining Improvements

Reference doc for future development work. Items are grouped by priority.

---

## 🔴 Security — Before Public Launch

### 1. Fix Overly Permissive RLS Policies
**Location:** `supabase/migrations/0002_rls_policies.sql`
**Issue:** Several tables use `WITH CHECK (true)` on INSERT, meaning any authenticated user can insert rows regardless of ownership.
**Affected tables:** `booking_offers`, `booking_assignments`, `threads`, `thread_participants`
**Fix:** Replace `WITH CHECK (true)` with proper authorization:
```sql
-- Example for booking_offers: only the coach who owns the booking can create offers
CREATE POLICY "coaches can create offers for their bookings"
ON booking_offers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = booking_offers.booking_id
    AND bookings.coach_id = auth.uid()
  )
);
```

### 2. Booking Detail Page — No Ownership Check
**Location:** `src/app/app/bookings/[id]/page.tsx` (lines 29-44)
**Issue:** The server component queries the booking directly by ID without verifying the user is the coach, an assigned referee, or has an offer. Any authenticated user can view any booking by guessing the UUID.
**Fix:** After fetching the booking, add:
```typescript
const isCoach = booking.coach_id === user.id
const isAssignedReferee = booking.assignment?.some(a => a.referee?.id === user.id)
const hasOffer = booking.offers?.some(o => o.referee_id === user.id)
if (!isCoach && !isAssignedReferee && !hasOffer) {
    notFound()
}
```

### 3. Add Rate Limiting for Critical Operations
**Issue:** No rate limiting exists on booking creation, offer sending, or auth endpoints.
**Recommendation:** Use Vercel's built-in rate limiting or add middleware-level rate limiting for:
- `POST /auth/login` — prevent brute force
- `createBooking` — prevent spam
- `sendBookingRequest` — prevent offer flooding

---

## 🟡 Performance — Before Scale

### 4. N+1 Query in `getThreads`
**Location:** `src/app/app/messages/actions.ts` (lines 121-145)
**Issue:** Runs 2 separate queries per thread in a loop to get participants and last message.
**Fix:** Rewrite as a single query with joins:
```typescript
const { data: threads } = await supabase
    .from('threads')
    .select(`
        *,
        participants:thread_participants(profile:profiles(*)),
        messages(body, created_at, sender_id)
    `)
    .order('created_at', { foreignTable: 'messages', ascending: false })
    .limit(1, { foreignTable: 'messages' })
```

### 5. Add Pagination to List Queries
**Affected locations:**
- `src/app/app/bookings/page.tsx` — all bookings loaded at once
- `src/app/app/messages/actions.ts` — all threads loaded at once
- `src/app/app/bookings/actions.ts` — search results not paginated

**Recommendation:** Add `.range(offset, offset + limit)` to queries, and implement infinite scroll or pagination UI with `offset` / `limit` query params.

### 6. Implement Soft Deletes
**Issue:** `deleteBooking` uses hard delete (`.delete()`). This loses audit trail.
**Fix:** Add a `deleted_at` timestamp column and filter by `deleted_at IS NULL` in all queries. Update `deleteBooking` to set `deleted_at = now()` instead.

---

## 🟡 Code Quality — Ongoing

### 7. Migrate Middleware to Proxy Convention
**Location:** `src/middleware.ts`
**Issue:** Next.js 16 shows deprecation warning: `The "middleware" file convention is deprecated. Please use "proxy" instead.`
**Docs:** https://nextjs.org/docs/messages/middleware-to-proxy
**Impact:** Not breaking yet, but will need migrating before Next.js 17.

### 8. Use `next/image` for Avatar Images
**Locations:**
- `src/app/app/messages/[threadId]/page.tsx:107`
- `src/components/app/ThreadListClient.tsx:107`

**Issue:** Raw `<img>` tags miss Next.js image optimization (lazy loading, responsive sizing, WebP conversion).
**Fix:** Replace with `<Image>` from `next/image`. Requires adding the Supabase storage domain to `next.config.ts`:
```typescript
images: {
    remotePatterns: [
        {
            protocol: 'https',
            hostname: '*.supabase.co',
            pathname: '/storage/v1/object/public/**',
        },
    ],
},
```

### 9. Replace Fire-and-Forget with Proper Error Handling
**Location:** `src/app/app/bookings/actions.ts` — `confirmPrice()` (steps 4-7)
**Issue:** After the core booking is confirmed, secondary steps (withdraw offers, create thread, notify referee, remove availability) only log errors. If these fail, the user never knows.
**Fix options:**
- Return partial success with warnings: `{ success: true, warnings: ['Thread creation failed'] }`
- Use a background job queue for non-critical steps
- Add a retry mechanism for transient failures

### 10. Add Transaction Safety to Multi-Step Operations
**Location:** `src/app/app/bookings/actions.ts:confirmPrice()` (lines 482-520)
**Issue:** Steps 1-3 (update offer → create assignment → update booking) are separate queries with manual rollback on failure. A crash between steps leaves data inconsistent.
**Fix:** Create a Supabase RPC function that wraps steps 1-3 in a PostgreSQL transaction:
```sql
CREATE OR REPLACE FUNCTION confirm_booking(p_offer_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE booking_offers SET status = 'accepted' WHERE id = p_offer_id;
    INSERT INTO booking_assignments (booking_id, referee_id)
        SELECT booking_id, referee_id FROM booking_offers WHERE id = p_offer_id;
    UPDATE bookings SET status = 'confirmed'
        WHERE id = (SELECT booking_id FROM booking_offers WHERE id = p_offer_id);
END;
$$ LANGUAGE plpgsql;
```

---

## 🟢 UX Polish — When Time Allows

### 11. Route-Specific Loading Skeletons
**Issue:** Only `src/app/app/loading.tsx` exists. All dynamic routes show the same generic skeleton.
**Add `loading.tsx` for:**
- `/app/bookings` — booking list skeleton
- `/app/bookings/[id]` — booking detail skeleton
- `/app/messages` — thread list skeleton
- `/app/messages/[threadId]` — chat skeleton
- `/app/profile` — profile skeleton

### 12. Structured Error Reporting
**Issue:** Client-side errors only appear in `console.error` (browser DevTools). Production errors are invisible.
**Recommendation:** Add Sentry (`@sentry/nextjs`) or a similar service. Provides:
- Automatic error capture with stack traces
- User session context
- Performance monitoring
- Alert notifications

### 13. Add Comprehensive Input Validation
**Issue:** Forms rely on HTML5 `required` attributes and minimal server-side checks. No validation for:
- Postcode format (UK pattern: `AA9A 9AA`)
- Phone number format
- Match date not in the past (server-side)
- Budget/price bounds

**Recommendation:** Add Zod schemas for server action inputs:
```typescript
const bookingSchema = z.object({
    match_date: z.string().refine(d => new Date(d) > new Date(), 'Date must be in the future'),
    location_postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, 'Invalid UK postcode'),
    kickoff_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    // ...
})
```

### 14. Add Tests
**Priority order:**
1. Server action tests — `createBooking`, `confirmPrice`, `cancelBooking` (most critical business logic)
2. Auth flow tests — `signIn`, `signUp`, redirect handling
3. E2E tests — full booking workflow: create → search → offer → accept → confirm
4. Component tests — `AwaitingAction`, `BookingCard`, form components

**Tooling:** Vitest for unit tests, Playwright for E2E.

---

## Completed ✅

- [x] Stats accordion open by default
- [x] Hide referees with accepted bookings from search
- [x] DBS safeguarding check visibility
- [x] FA number editing with verification reset (was already done)
- [x] Google Maps embed for venue postcode
- [x] Fix auto-submit bug on booking forms
- [x] Comprehensive favicon/icon support
- [x] Fix awaiting action persistence bug
- [x] Fix open redirect vulnerability
- [x] Add security headers
- [x] Remove console.log debug leaks
- [x] Fix `as any` type assertions
- [x] Clean up all ESLint warnings (0 errors, 0 warnings)
- [x] Add custom 404 page
- [x] Add `getBooking` ownership check
- [x] Add env var validation
