import { AlertTriangle } from 'lucide-react'

export default async function ParentConsentErrorPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string }>
}) {
    const params = await searchParams
    const reason = params.reason

    const messages: Record<string, { title: string; body: string }> = {
        invalid: {
            title: 'Invalid Link',
            body: 'This consent link appears to be malformed or incomplete. Please use the exact link from the email we sent you.',
        },
        not_found: {
            title: 'Request Not Found',
            body: 'We could not find a consent request matching this link. It may have expired or already been processed.',
        },
        expired: {
            title: 'Link Expired',
            body: 'This consent link has expired. Please ask the referee to request a new consent email, or contact us for assistance.',
        },
        server: {
            title: 'Server Error',
            body: 'Something went wrong on our end. Please try again later or contact us for assistance.',
        },
    }

    const msg = messages[reason || ''] || messages.server

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
                    <AlertTriangle className="mx-auto h-16 w-16 text-amber-500 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">
                        {msg.title}
                    </h2>
                    <p className="text-gray-600 leading-relaxed">
                        {msg.body}
                    </p>

                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <p className="text-gray-400 text-sm">
                            If you continue to experience issues, please contact us at{' '}
                            <a href="mailto:support@whistle-connect.com" className="text-[#1d2557] underline">
                                support@whistle-connect.com
                            </a>
                        </p>
                    </div>
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
