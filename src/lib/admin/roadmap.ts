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
        detail: 'Three-step Stripe transfer with audit table prevents money-loss on partial failure.',
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
        title: 'Security hardening sprint',
        status: 'planned',
        detail: 'Tighten RLS on booking_offers / booking_assignments and add authorisation checks to cancelBooking and deleteBooking.',
    },
    {
        title: 'County FA admin dashboard',
        status: 'planned',
        detail: 'County-scoped referee + dispute view designed alongside Northumberland FA as the design partner.',
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
        title: 'Vercel Pro upgrade',
        status: 'planned',
        detail: 'Required ahead of pilot scale to unlock real cron cadence (Hobby tier throttles to once-per-day).',
    },
]
