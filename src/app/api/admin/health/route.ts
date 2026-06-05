import { NextRequest, NextResponse } from 'next/server'

/**
 * Deploy/health probe for required server-side configuration. Returns ONLY
 * booleans (the presence of each env var) — never any secret value. Lets a
 * post-deploy smoke check confirm the running deployment actually has the
 * service-role key, Firebase, VAPID, and Stripe configured, so a missing key
 * surfaces loudly (here, and via the fail-loud paths) instead of as a silent
 * runtime no-op.
 *
 * Auth: Bearer CRON_SECRET (same gate as push-debug — no new surface area).
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = {
        service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        firebase: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        vapid: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
        stripe: !!process.env.STRIPE_SECRET_KEY,
        stripe_webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
        stripe_connect_webhook: !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
        cron_secret: !!process.env.CRON_SECRET,
    }

    // `healthy` is true only when every required key is present. The
    // service-role key is the one whose absence silently breaks account
    // deletion, suspension, escrow refunds and notification fan-out.
    const healthy = Object.values(config).every(Boolean)

    return NextResponse.json({ ok: true, healthy, config }, { status: healthy ? 200 : 503 })
}
