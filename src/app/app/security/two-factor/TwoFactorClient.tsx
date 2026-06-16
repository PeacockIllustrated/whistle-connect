'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ShieldCheck, ShieldAlert, Loader2, KeyRound } from 'lucide-react'

type Mode = 'loading' | 'intro_enroll' | 'enroll_qr' | 'challenge' | 'enabled' | 'error'

/**
 * Self-service TOTP (authenticator-app) two-factor management.
 *
 * Drives four states off the live Supabase MFA API:
 *  - intro_enroll : no verified factor yet → offer to set one up
 *  - enroll_qr    : a fresh factor was created → show QR + secret, verify a code
 *  - challenge    : a verified factor exists but this session is only aal1 → step up
 *  - enabled      : session is aal2 → show enabled, allow removal
 *
 * When `required` is set (the admin gate sent the user here), a successful
 * verification replaces the route with `next` so they land where they were going.
 */
export function TwoFactorClient({ required = false, next = '/app' }: { required?: boolean; next?: string }) {
    const router = useRouter()
    // Memoise the browser client so the effect's deps stay stable (createClient()
    // returns a new instance each render otherwise → effect loop).
    const [supabase] = useState(() => createClient())

    const [mode, setMode] = useState<Mode>('loading')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [code, setCode] = useState('')

    const [factorId, setFactorId] = useState('')
    const [qr, setQr] = useState('')
    const [secret, setSecret] = useState('')

    const refreshState = useCallback(async () => {
        setError('')
        const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors()
        if (fErr) {
            setError(fErr.message)
            setMode('error')
            return
        }
        const verified = (factors?.totp ?? []).filter((f) => f.status === 'verified')
        if (verified.length === 0) {
            setMode('intro_enroll')
            return
        }
        setFactorId(verified[0].id)
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        setMode(aal?.currentLevel === 'aal2' ? 'enabled' : 'challenge')
    }, [supabase])

    useEffect(() => {
        refreshState()
    }, [refreshState])

    async function beginEnroll() {
        setBusy(true)
        setError('')
        try {
            // Clear out any abandoned, unverified factors so a new enrol doesn't
            // collide with a half-finished one from a previous attempt.
            const { data: factors } = await supabase.auth.mfa.listFactors()
            for (const f of factors?.all ?? []) {
                if (f.status === 'unverified') {
                    await supabase.auth.mfa.unenroll({ factorId: f.id })
                }
            }
            const { data, error: eErr } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
            })
            if (eErr || !data) {
                setError(eErr?.message ?? 'Could not start two-factor setup.')
                return
            }
            setFactorId(data.id)
            setQr(data.totp.qr_code)
            setSecret(data.totp.secret)
            setCode('')
            setMode('enroll_qr')
        } finally {
            setBusy(false)
        }
    }

    async function verify() {
        if (code.trim().length < 6) {
            setError('Enter the 6-digit code from your authenticator app.')
            return
        }
        setBusy(true)
        setError('')
        try {
            const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
                factorId,
                code: code.trim(),
            })
            if (vErr) {
                setError(vErr.message || 'That code was not accepted. Try the next one.')
                return
            }
            // Session is now aal2. Refresh server components so the new assurance
            // level is visible, then send the user on if they were gated here.
            router.refresh()
            if (required) {
                router.replace(next)
                return
            }
            setCode('')
            setQr('')
            setSecret('')
            setMode('enabled')
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!factorId) return
        setBusy(true)
        setError('')
        try {
            const { error: uErr } = await supabase.auth.mfa.unenroll({ factorId })
            if (uErr) {
                setError(uErr.message)
                return
            }
            router.refresh()
            await refreshState()
        } finally {
            setBusy(false)
        }
    }

    if (mode === 'loading') {
        return (
            <div className="card p-6 flex items-center justify-center gap-3 text-[var(--foreground-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading…</span>
            </div>
        )
    }

    if (mode === 'error') {
        return (
            <div className="card p-5 space-y-3">
                <div className="flex items-start gap-2 text-red-700">
                    <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">{error || 'Something went wrong.'}</p>
                </div>
                <Button variant="outline" onClick={refreshState}>Try again</Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {required && mode !== 'enabled' && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>Two-factor authentication is required for admin access. Set it up to continue.</p>
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {error}
                </div>
            )}

            {mode === 'intro_enroll' && (
                <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                            <KeyRound className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Authenticator app</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Add a second step at sign-in using an app like Google Authenticator, Authy or 1Password.
                            </p>
                        </div>
                    </div>
                    <Button onClick={beginEnroll} loading={busy} fullWidth>
                        Set up two-factor authentication
                    </Button>
                </div>
            )}

            {mode === 'enroll_qr' && (
                <div className="card p-5 space-y-4">
                    <h2 className="font-semibold">Scan this code</h2>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Scan the QR code with your authenticator app, then enter the 6-digit code it shows.
                    </p>
                    {qr && (
                        <div className="flex justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={qr}
                                alt="Two-factor QR code"
                                width={200}
                                height={200}
                                className="rounded-lg border border-[var(--border-color)] bg-white p-2"
                            />
                        </div>
                    )}
                    {secret && (
                        <p className="text-center text-xs text-[var(--foreground-muted)]">
                            Can&apos;t scan? Enter this key manually:
                            <br />
                            <span className="font-mono break-all text-[var(--foreground)]">{secret}</span>
                        </p>
                    )}
                    <Input
                        label="6-digit code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                    />
                    <Button onClick={verify} loading={busy} fullWidth>
                        Verify &amp; enable
                    </Button>
                </div>
            )}

            {mode === 'challenge' && (
                <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                            <KeyRound className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Enter your code</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Open your authenticator app and enter the current 6-digit code.
                            </p>
                        </div>
                    </div>
                    <Input
                        label="6-digit code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                    />
                    <Button onClick={verify} loading={busy} fullWidth>
                        Verify
                    </Button>
                </div>
            )}

            {mode === 'enabled' && (
                <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Two-factor is on</h2>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Your account is protected with an authenticator app.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={() => router.push(next || '/app')}>
                            Continue
                        </Button>
                        <Button variant="ghost" onClick={remove} loading={busy} className="text-red-600">
                            Remove two-factor
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
