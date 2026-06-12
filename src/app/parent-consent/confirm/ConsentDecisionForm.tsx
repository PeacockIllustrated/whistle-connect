'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

/**
 * Parent/guardian Approve / Decline buttons. Renders a native form that POSTs
 * to /api/parent-consent, so the account is only ever resolved by an explicit
 * human click (never an automated email-scanner GET). Works without JS; the
 * client handler only disables the buttons to prevent a double submit.
 */
export default function ConsentDecisionForm({ token }: { token: string }) {
    const [submitting, setSubmitting] = useState<'approved' | 'rejected' | null>(null)

    return (
        <form
            method="post"
            action="/api/parent-consent"
            onSubmit={(e) => {
                const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
                setSubmitting(action === 'rejected' ? 'rejected' : 'approved')
            }}
            className="flex flex-col gap-3"
        >
            <input type="hidden" name="token" value={token} />

            <button
                type="submit"
                name="action"
                value="approved"
                disabled={submitting !== null}
                className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <Check className="h-5 w-5" />
                {submitting === 'approved' ? 'Approving…' : 'Approve account'}
            </button>

            <button
                type="submit"
                name="action"
                value="rejected"
                disabled={submitting !== null}
                className="inline-flex items-center justify-center w-full h-11 rounded-lg border-2 border-gray-200 bg-white text-red-600 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {submitting === 'rejected' ? 'Declining…' : 'Decline'}
            </button>
        </form>
    )
}
