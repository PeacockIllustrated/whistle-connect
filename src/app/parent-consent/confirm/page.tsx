import { AlertTriangle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import ConsentDecisionForm from './ConsentDecisionForm'

/**
 * Read-only confirmation page for the parental-consent email link.
 *
 * This page MUST NOT mutate anything — it only validates the token and shows
 * the child's name with Approve / Decline buttons that POST to
 * /api/parent-consent. This is the fix for the state-mutating-GET problem:
 * email security scanners that prefetch the link land here and read, but the
 * account is only ever resolved by an explicit human click (POST).
 */

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

function isExpired(expiresAt: string | null, createdAt: string | null): boolean {
    if (expiresAt) return new Date(expiresAt).getTime() < Date.now()
    if (createdAt) return new Date(createdAt).getTime() + TOKEN_TTL_MS < Date.now()
    return false
}

export default async function ParentConsentConfirmPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>
}) {
    const { token } = await searchParams

    let state: 'ready' | 'invalid' | 'not_found' | 'expired' | 'already_resolved' | 'server' = 'ready'
    let childName = ''

    if (!token) {
        state = 'invalid'
    } else {
        const adminClient = createAdminClient()
        if (!adminClient) {
            state = 'server'
        } else {
            const { data: consent, error } = await adminClient
                .from('parental_consents')
                .select('child_name, status, created_at, expires_at')
                .eq('response_token', token)
                .single()

            if (error || !consent) {
                state = 'not_found'
            } else if (consent.status !== 'awaiting') {
                state = 'already_resolved'
            } else if (isExpired(consent.expires_at, consent.created_at)) {
                state = 'expired'
            } else {
                childName = consent.child_name
            }
        }
    }

    const notices: Record<string, { title: string; body: string }> = {
        invalid: {
            title: 'Invalid Link',
            body: 'This consent link appears to be malformed or incomplete. Please use the exact link from the email we sent you.',
        },
        not_found: {
            title: 'Request Not Found',
            body: 'We could not find a consent request matching this link. It may have already been processed.',
        },
        expired: {
            title: 'Link Expired',
            body: 'This consent link has expired. Please ask the referee to request a new consent email, or contact us for assistance.',
        },
        already_resolved: {
            title: 'Already Responded',
            body: 'This consent request has already been resolved. No further action is needed.',
        },
        server: {
            title: 'Server Error',
            body: 'Something went wrong on our end. Please try again later or contact us for assistance.',
        },
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-lg w-full overflow-hidden">
                <div className="bg-[#1d2557] px-8 py-8 text-center">
                    <h1 className="text-white text-2xl font-bold tracking-wide">
                        WHISTLE CONNECT
                    </h1>
                    <p className="text-white/60 text-sm mt-1">FA Referee Management</p>
                </div>

                <div className="px-8 py-10 text-center">
                    {state === 'ready' ? (
                        <>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                Parental consent
                            </h2>
                            <p className="text-gray-600 leading-relaxed mb-6">
                                <strong className="text-gray-800">{childName}</strong> has
                                registered as a referee on Whistle Connect. Because they are
                                under 18, we need a parent or guardian to confirm before the
                                account can be used.
                            </p>
                            <ConsentDecisionForm token={token!} />
                            <p className="text-gray-400 text-sm mt-6">
                                Only approve if you are the parent or guardian of this referee.
                            </p>
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="mx-auto h-16 w-16 text-amber-500 mb-4" />
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                {notices[state].title}
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                {notices[state].body}
                            </p>
                        </>
                    )}
                </div>

                <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
                    <p className="text-gray-400 text-xs">
                        &copy; {new Date().getFullYear()} Whistle Connect. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
