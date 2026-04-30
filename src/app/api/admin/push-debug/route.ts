import { NextRequest, NextResponse } from 'next/server'

/**
 * Diagnostic endpoint for VAPID key state. Returns ONLY a public-key
 * fingerprint (first 12 chars + length) — never the private key value.
 *
 * Used to verify after a key rotation that the running serverless
 * function picked up the new env vars. Without this, the only way to
 * confirm is to send a push and see if it 403s.
 *
 * Auth: Bearer CRON_SECRET (same gate as the broadcast endpoint — no
 * new surface area).
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
    const priv = process.env.VAPID_PRIVATE_KEY || ''
    const subj = process.env.VAPID_SUBJECT || ''

    return NextResponse.json({
        ok: true,
        public_key: {
            present: !!pub,
            length: pub.length,
            // First 12 + last 4 — enough to match against the value the
            // operator pasted into Vercel without exposing the whole key
            // (though the public key isn't sensitive — just keeping
            // surface area small in case this endpoint logs anywhere).
            fingerprint: pub ? `${pub.slice(0, 12)}…${pub.slice(-4)}` : null,
            has_quotes: pub.startsWith('"') || pub.startsWith("'"),
            has_whitespace: pub !== pub.trim(),
        },
        private_key: {
            present: !!priv,
            length: priv.length,
            has_quotes: priv.startsWith('"') || priv.startsWith("'"),
            has_whitespace: priv !== priv.trim(),
        },
        subject: {
            present: !!subj,
            value: subj,
        },
        deploy_id: process.env.VERCEL_DEPLOYMENT_ID || null,
        commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        deployed_at: process.env.VERCEL_GIT_COMMIT_REF
            ? `${process.env.VERCEL_GIT_COMMIT_REF}@${(process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)}`
            : null,
    })
}
