import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { TwoFactorClient } from './TwoFactorClient'

/**
 * Security → Two-factor authentication.
 *
 * Reachable by every signed-in user from their profile (MFA is optional for
 * coaches/referees, mandatory for admins — enforced by /app/admin/layout.tsx,
 * which redirects un-stepped-up admins here with ?required=1).
 *
 * Deliberately lives OUTSIDE /app/admin so the admin MFA gate can send users
 * here to enrol without creating a redirect loop.
 */
export default async function TwoFactorPage({
    searchParams,
}: {
    searchParams: Promise<{ required?: string; next?: string }>
}) {
    const sp = await searchParams
    const required = sp.required === '1'
    // Only honour relative, non-protocol-relative redirect targets.
    const next =
        typeof sp.next === 'string' && sp.next.startsWith('/') && !sp.next.startsWith('//')
            ? sp.next
            : '/app'

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app/profile" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Two-factor authentication</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Add an extra layer of security to your account.
                    </p>
                </div>
            </div>

            <TwoFactorClient required={required} next={next} />
        </div>
    )
}
