export type RoadmapStatus = 'done' | 'in-progress' | 'planned'

export interface RoadmapItem {
    title: string
    status: RoadmapStatus
    detail: string
}

export const ROADMAP_ITEMS: RoadmapItem[] = [
    {
        title: 'Sentry observability',
        status: 'done',
        detail: 'Server, edge, and client error capture wired with environment tagging and source maps.',
    },
    {
        title: 'Atomic withdrawal pattern',
        status: 'done',
        detail: 'Three-step Stripe transfer with audit table prevents money-loss on partial failure. Stripe Connect onboarding hardened against platform-config gaps.',
    },
    {
        title: 'Mutual confirmation + escrow release',
        status: 'done',
        detail: 'Both-confirm and 48h kickoff fallback paths live; runs every 15 minutes.',
    },
    {
        title: 'County FA email routing',
        status: 'done',
        detail: 'Verification emails resolve to each county FA address via county_fa_contacts. Fallback alerts on missing counties.',
    },
    {
        title: 'Operational triage dashboard',
        status: 'done',
        detail: 'Single-glance admin home: pending FA verifications, open disputes, stuck escrow, stuck withdrawals, DBS expiring, webhook failures. Each tile drill-downs to a filtered view.',
    },
    {
        title: 'Signup consent + audit trail',
        status: 'done',
        detail: 'Coaches and referees explicitly accept Terms, Privacy, and FA safeguarding data-sharing at signup. Consent timestamps server-stamped into Supabase user_metadata for audit.',
    },
    {
        title: 'Per-user archive across bookings, offers, and threads',
        status: 'done',
        detail: 'Coaches and referees can archive items independently with recoverable trays. Swipe-to-archive in lists; partial indexes back the active and archived hot paths.',
    },
    {
        title: 'SOS premium fee gate',
        status: 'done',
        detail: 'Each SOS broadcast costs £1.99, debited atomically from the coach wallet via FOR-UPDATE locking. Non-refundable: keeps the SOS signal meaningful for refs.',
    },
    {
        title: 'Booking cancellation + deletion authorisation',
        status: 'done',
        detail: 'cancelBooking verifies the actor is either the coach or assigned referee with the correct role for the booking state; deleteBooking checks coach ownership before the soft-delete touches the row.',
    },
    {
        title: 'RLS tightening on booking_offers + booking_assignments',
        status: 'planned',
        detail: 'Replace the current WITH CHECK (true) INSERT policies with user-scoped guards so server-side authorisation is the only line of defence, not the last.',
    },
    {
        title: 'County FA admin dashboard',
        status: 'planned',
        detail: 'County-scoped referee + dispute view, building on the platform-wide triage dashboard infrastructure. Designed alongside Northumberland FA as the design partner.',
    },
    {
        title: 'FA register CSV import + auto-confirm',
        status: 'planned',
        detail: 'Counties upload their existing referee list once; matching FA numbers auto-resolve without an officer round-trip.',
    },
    {
        title: 'DBS expiry automated reminders',
        status: 'planned',
        detail: 'Scheduled notifications to referees 30 days before DBS expiry. Tile is live on this dashboard ahead of automation.',
    },
    {
        title: 'Phase 2 Stripe webhook handlers',
        status: 'planned',
        detail: 'checkout.session.completed, account.updated, and transfer.reversed are already handled. Outstanding: charge.refunded, charge.dispute.created, payout.* — close the loop on Stripe-side state changes that currently rely on cron sweeps.',
    },
    {
        title: 'Native push for Capacitor wrapper',
        status: 'planned',
        detail: 'firebase-admin already wired server-side. FCM client SDK integration ahead of the iOS / Android wrapper builds.',
    },
    {
        title: 'Vercel Pro upgrade',
        status: 'planned',
        detail: 'Required ahead of pilot scale to unlock real cron cadence (Hobby tier throttles to once-per-day).',
    },
]
