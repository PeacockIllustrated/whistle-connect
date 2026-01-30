# Whistle Connect - AI Development Guide

## Project Overview

**Whistle Connect** is a grassroots football operations app that streamlines referee bookings and match communications. It connects coaches who need referees with qualified officials who are available.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.1 (App Router) |
| UI | React 19.2.3, Tailwind CSS 4 |
| Language | TypeScript 5 (strict mode) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Real-time | Supabase Realtime |
| Storage | Supabase Storage (avatars) |
| Notifications | Web Push API |
| Deployment | Vercel |

### Core Business Logic

**User Roles**: `coach` | `referee` | `admin`

**Booking Workflow**:
```
draft → pending → offered → confirmed → completed
                     ↓
                 cancelled
```

**Offer Workflow**:
```
sent → accepted_priced → accepted
  ↓         ↓
declined  withdrawn
```

---

## Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── auth/                     # Login, registration pages
│   ├── app/                      # Protected routes (requires auth)
│   │   ├── admin/                # Admin: referee verification
│   │   ├── availability/         # Referee availability management
│   │   ├── bookings/             # Booking CRUD and workflow
│   │   │   ├── actions.ts        # Server actions for bookings
│   │   │   └── [id]/             # Individual booking pages
│   │   ├── messages/             # Messaging threads
│   │   ├── offers/               # Referee offer inbox
│   │   └── profile/              # User profile management
│   ├── book/                     # Public booking pages
│   └── layout.tsx                # Root layout with ThemeProvider
├── components/
│   ├── app/                      # Feature-specific components
│   ├── profile/                  # Profile-related components
│   └── ui/                       # Reusable UI primitives
├── lib/
│   ├── auth/actions.ts           # Auth server actions
│   ├── supabase/                 # Supabase client setup
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Session refresh
│   ├── notifications.ts          # Push notification handling
│   ├── types.ts                  # TypeScript type definitions
│   └── utils.ts                  # Utility functions
└── middleware.ts                 # Auth route protection

supabase/
├── migrations/                   # Database migrations (ordered)
├── config.toml                   # Supabase project config
└── emails/                       # Email templates
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to auth.users) |
| `referee_profiles` | Extended referee data (level, county, DBS status) |
| `referee_availability` | Recurring weekly availability slots |
| `referee_date_availability` | Date-specific availability overrides |
| `bookings` | Match booking records |
| `booking_offers` | Offers sent from coaches to referees |
| `booking_assignments` | Confirmed referee assignments |
| `threads` | Message thread containers |
| `thread_participants` | Thread membership tracking |
| `messages` | Individual messages |
| `notifications` | In-app notifications |
| `push_subscriptions` | Web push subscriptions |

### Key Relationships

- `bookings.coach_id` → `profiles.id`
- `booking_offers.booking_id` → `bookings.id`
- `booking_offers.referee_id` → `profiles.id`
- `messages.thread_id` → `threads.id`
- `referee_profiles.profile_id` → `profiles.id`

---

## Development Patterns

### Server Actions

All data mutations use Next.js Server Actions in `actions.ts` files:

```typescript
'use server'

export async function actionName(params) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // ... operation

    revalidatePath('/app/...')
    return { success: true }
}
```

### Error Handling Convention

Return `{ error: string }` or `{ success: true }` from actions:

```typescript
// Good
return { error: 'Booking not found' }
return { success: true }

// Avoid mixing patterns (throwing vs returning)
```

### Supabase Queries

Use the SSR client for server components and actions:

```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase.from('table').select('*')
```

### Component Patterns

- Server Components by default (no 'use client' unless needed)
- Client Components for interactivity (`'use client'` directive)
- UI primitives in `src/components/ui/`
- Feature components in `src/components/app/`

---

## Known Issues (Priority Order)

### Critical - Fix First

1. **Overly Permissive RLS Policies**
   - Location: `supabase/migrations/0002_rls_policies.sql`
   - Issue: `WITH CHECK (true)` allows any authenticated user to insert
   - Affected: `booking_offers`, `booking_assignments`, `threads`, `thread_participants`
   - Fix: Add proper authorization checks

2. **Fire-and-Forget Async Operations**
   - Location: `src/app/app/bookings/actions.ts:92-100`
   - Issue: `forEach(async ...)` doesn't await, notifications may silently fail
   - Fix: Use `Promise.allSettled()` with error handling

3. **Profile Creation Race Condition**
   - Location: `src/lib/auth/actions.ts:59-93`
   - Issue: Uses 500ms setTimeout workaround for trigger timing
   - Fix: Implement proper trigger validation or retry logic

### High Priority

4. **No Transaction Handling**
   - Location: `src/app/app/bookings/actions.ts:272-340` (confirmPrice)
   - Issue: Multi-step operations can leave data in inconsistent state
   - Fix: Use Supabase transactions or implement rollback logic

5. **Missing Authorization Checks**
   - `cancelBooking` allows anyone to cancel (line 156)
   - `deleteBooking` deletes before verifying ownership result
   - Fix: Verify authorization before performing mutations

6. **Duplicate Null Check**
   - Location: `src/app/app/bookings/actions.ts:395-404`
   - Issue: `if (booking) { if (booking) { ... } }` - redundant
   - Fix: Remove inner duplicate check

### Medium Priority

7. **Unsafe Type Assertions**
   - Location: `bookings/actions.ts:463, 596`
   - Issue: `(r.availability as any).length` defeats TypeScript
   - Fix: Define proper types for Supabase join results

8. **N+1 Query in getThreads**
   - Location: `src/app/app/messages/actions.ts:121-145`
   - Issue: 2 queries per thread in a loop
   - Fix: Batch queries or use proper joins

9. **Missing Notifications RLS INSERT Policy**
   - Location: `supabase/migrations/0103_notifications_system.sql`
   - Issue: No INSERT policy defined
   - Fix: Add policy requiring authenticated user

---

## Improvement Roadmap

### Phase 1: Security Hardening
- [ ] Fix overly permissive RLS policies
- [ ] Add authorization checks to all mutations
- [ ] Implement proper input validation
- [ ] Add rate limiting for critical operations

### Phase 2: Code Quality
- [ ] Replace forEach(async) with Promise.allSettled
- [ ] Standardize error handling pattern
- [ ] Fix TypeScript type issues (remove `as any`)
- [ ] Add error boundaries to pages

### Phase 3: Performance
- [ ] Fix N+1 queries
- [ ] Add pagination to list queries
- [ ] Implement soft deletes
- [ ] Add caching where appropriate

### Phase 4: Features
- [ ] Add comprehensive input validation
- [ ] Implement audit logging
- [ ] Add unit tests for server actions
- [ ] Create E2E tests for critical flows

---

## Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key  # Optional, for admin ops

# Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public
VAPID_PRIVATE_KEY=your_vapid_private
```

---

## Quick Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

---

## Testing Checklist

When making changes, verify:

1. **Auth Flow**: Login/Register works, session persists
2. **Booking Flow**: Create → Search → Offer → Accept → Confirm
3. **Messaging**: Thread creation, message send/receive
4. **Notifications**: In-app and push notifications delivered
5. **Availability**: Recurring and date-specific slots saved

---

## Notes for AI Assistants

- Always use `await createClient()` for Supabase (server client is async)
- Check user authentication before any data operation
- Use `revalidatePath()` after mutations to refresh UI
- Prefer editing existing files over creating new ones
- Follow existing patterns in the codebase
- Run `npm run build` to verify no TypeScript errors before committing
