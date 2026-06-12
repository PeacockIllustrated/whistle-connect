import { AlertTriangle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import FAVerifyDecisionForm from './FAVerifyDecisionForm'

/**
 * Read-only confirmation page for the FA-verification email link.
 *
 * This page MUST NOT mutate anything — it only validates the token and shows
 * the referee's details with Confirm / Not found buttons that POST to
 * /api/fa-verify. This is the fix for the state-mutating-GET problem: email
 * security scanners that prefetch the link land here and read, but the request
 * is only ever resolved by an explicit human click (POST).
 */

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

function isExpired(expiresAt: string | null, createdAt: string | null): boolean {
    if (expiresAt) return new Date(expiresAt).getTime() < Date.now()
    if (createdAt) return new Date(createdAt).getTime() + TOKEN_TTL_MS < Date.now()
    return false
}

export default async function FAVerifyConfirmPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>
}) {
    const { token } = await searchParams

    let state: 'ready' | 'invalid' | 'not_found' | 'expired' | 'already_resolved' | 'server' = 'ready'
    let refereeFaId = ''
    let county = ''

    if (!token) {
        state = 'invalid'
    } else {
        const adminClient = createAdminClient()
        if (!adminClient) {
            state = 'server'
        } else {
            const { data: req, error } = await adminClient
                .from('fa_verification_requests')
                .select('fa_id, county, status, created_at, expires_at')
                .eq('response_token', token)
                .single()

            if (error || !req) {
                state = 'not_found'
            } else if (req.status !== 'awaiting_fa_response') {
                state = 'already_resolved'
            } else if (isExpired(req.expires_at, req.created_at)) {
                state = 'expired'
            } else {
                refereeFaId = req.fa_id
                county = req.county
            }
        }
    }

    const notices: Record<string, { title: string; body: string }> = {
        invalid: {
            title: 'Invalid Link',
            body: 'This verification link appears to be malformed or incomplete. Please use the exact link from the verification email.',
        },
        not_found: {
            title: 'Request Not Found',
            body: 'We could not find a verification request matching this link. It may have already been processed.',
        },
        expired: {
            title: 'Link Expired',
            body: 'This verification link has expired. Please ask Whistle Connect to send a fresh request, or contact us for assistance.',
        },
        already_resolved: {
            title: 'Already Responded',
            body: 'This verification request has already been resolved. No further action is needed.',
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
                                Confirm FA registration
                            </h2>
                            <p className="text-gray-600 leading-relaxed mb-5">
                                Please confirm whether the following FA registration number is
                                valid and currently active.
                            </p>
                            <div className="bg-gray-50 rounded-lg px-5 py-4 text-left text-sm text-gray-700 mb-6">
                                <p>
                                    <strong className="text-gray-800">FA number:</strong> {refereeFaId}
                                </p>
                                <p className="mt-1">
                                    <strong className="text-gray-800">County FA:</strong> {county}
                                </p>
                            </div>
                            <FAVerifyDecisionForm token={token!} />
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
