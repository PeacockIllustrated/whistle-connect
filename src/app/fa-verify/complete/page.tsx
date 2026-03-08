import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default async function FAVerifyCompletePage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; action?: string }>
}) {
    const params = await searchParams
    const status = params.status
    const previousAction = params.action

    const isConfirmed = status === 'confirmed'
    const isRejected = status === 'rejected'
    const isAlreadyResolved = status === 'already_resolved'

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-lg w-full overflow-hidden">
                {/* Header */}
                <div className="bg-[#1d2557] px-8 py-8 text-center">
                    <h1 className="text-white text-2xl font-bold tracking-wide">
                        WHISTLE CONNECT
                    </h1>
                    <p className="text-white/60 text-sm mt-1">FA Referee Management</p>
                </div>

                {/* Body */}
                <div className="px-8 py-10 text-center">
                    {isAlreadyResolved ? (
                        <>
                            <AlertCircle className="mx-auto h-16 w-16 text-amber-500 mb-4" />
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                Already Responded
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                This verification request has already been resolved
                                {previousAction === 'confirmed' && ' as confirmed'}
                                {previousAction === 'rejected' && ' as rejected'}.
                                No further action is needed.
                            </p>
                        </>
                    ) : isConfirmed ? (
                        <>
                            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                Verification Confirmed
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                Thank you for confirming this FA registration. The referee
                                has been notified and their credentials have been verified on
                                the Whistle Connect platform.
                            </p>
                        </>
                    ) : isRejected ? (
                        <>
                            <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                Registration Not Found
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                Thank you for your response. The referee has been notified
                                that their FA number could not be verified. They will be
                                asked to review their registration details.
                            </p>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                Response Received
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                Thank you for your response. We have recorded your decision.
                            </p>
                        </>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <p className="text-gray-400 text-sm">
                            You can safely close this page.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
                    <p className="text-gray-400 text-xs">
                        &copy; {new Date().getFullYear()} Whistle Connect. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
