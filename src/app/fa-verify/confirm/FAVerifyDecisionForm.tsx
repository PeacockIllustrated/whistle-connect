'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

/**
 * County FA Confirm / Not found buttons. Renders a native form that POSTs to
 * /api/fa-verify, so the request is only ever resolved by an explicit human
 * click (never an automated email-scanner GET). Works without JS; the client
 * handler only disables the buttons to prevent a double submit.
 */
export default function FAVerifyDecisionForm({ token }: { token: string }) {
    const [submitting, setSubmitting] = useState<'confirmed' | 'rejected' | null>(null)

    return (
        <form
            method="post"
            action="/api/fa-verify"
            onSubmit={(e) => {
                const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
                setSubmitting(action === 'rejected' ? 'rejected' : 'confirmed')
            }}
            className="flex flex-col gap-3"
        >
            <input type="hidden" name="token" value={token} />

            <button
                type="submit"
                name="action"
                value="confirmed"
                disabled={submitting !== null}
                className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <Check className="h-5 w-5" />
                {submitting === 'confirmed' ? 'Confirming…' : 'Confirm registration'}
            </button>

            <button
                type="submit"
                name="action"
                value="rejected"
                disabled={submitting !== null}
                className="inline-flex items-center justify-center w-full h-11 rounded-lg border-2 border-gray-200 bg-white text-red-600 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {submitting === 'rejected' ? 'Submitting…' : 'Not found'}
            </button>
        </form>
    )
}
