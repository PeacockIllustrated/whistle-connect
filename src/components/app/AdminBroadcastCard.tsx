'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Megaphone, Send } from 'lucide-react'
import { broadcastNotification } from '@/app/app/admin/actions'

const TITLE_MAX = 60
const MESSAGE_MAX = 300

const DEFAULT_TITLE = 'A quick reminder from Whistle Connect'
const DEFAULT_MESSAGE =
    'Got a match coming up? Open the app to check your bookings, set your availability and stay match-ready.'

/**
 * Admin-only broadcast composer. Sends an in-app notification + web push + FCM
 * to every user via the `broadcastNotification` server action (requireAdmin —
 * no CRON_SECRET in the browser). A confirm step shows the recipient count
 * (dry run) before anything is sent, because the send reaches everyone and
 * can't be recalled.
 */
export function AdminBroadcastCard() {
    const [title, setTitle] = useState(DEFAULT_TITLE)
    const [message, setMessage] = useState(DEFAULT_MESSAGE)
    const [link, setLink] = useState('/app')

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [recipients, setRecipients] = useState<number | null>(null)
    const [result, setResult] = useState('')
    const [error, setError] = useState('')
    const [pending, startTransition] = useTransition()

    const titleValid = title.trim().length > 0 && title.trim().length <= TITLE_MAX
    const messageValid = message.trim().length > 0 && message.trim().length <= MESSAGE_MAX
    const canSend = titleValid && messageValid

    function openConfirm() {
        setError('')
        setResult('')
        if (!canSend) {
            setError('Add a title (≤60 chars) and a message (≤300 chars) first.')
            return
        }
        setRecipients(null)
        setConfirmOpen(true)
        // Fetch the recipient count so the admin confirms against a real number.
        startTransition(async () => {
            const res = await broadcastNotification({ title, message, link, dryRun: true })
            if (res.error) {
                setError(res.error)
                setConfirmOpen(false)
                return
            }
            setRecipients(res.recipients ?? 0)
        })
    }

    function send() {
        startTransition(async () => {
            const res = await broadcastNotification({ title, message, link })
            if (res.error) {
                setError(res.error)
                setConfirmOpen(false)
                return
            }
            setResult(`Sent to ${res.dispatched ?? 0} of ${res.recipients ?? 0} users.`)
            setConfirmOpen(false)
        })
    }

    return (
        <Card variant="default" padding="md" className="mb-6">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold">Send a reminder</h2>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Push a notification to every user (in-app + phone).
                    </p>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                        Title <span className="text-[var(--foreground-subtle)]">({title.trim().length}/{TITLE_MAX})</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        maxLength={TITLE_MAX}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                        placeholder="Notification title"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                        Message <span className="text-[var(--foreground-subtle)]">({message.trim().length}/{MESSAGE_MAX})</span>
                    </label>
                    <textarea
                        value={message}
                        maxLength={MESSAGE_MAX}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 text-sm border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] resize-none"
                        placeholder="What do you want to remind people about?"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                        Opens on tap
                    </label>
                    <input
                        type="text"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                        placeholder="/app"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {result && (
                    <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        {result}
                    </p>
                )}

                <button
                    onClick={openConfirm}
                    disabled={pending || !canSend}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                    Send to all users
                </button>
            </div>

            <Modal
                isOpen={confirmOpen}
                onClose={() => { if (!pending) setConfirmOpen(false) }}
                title="Send to all users?"
                size="md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-[var(--foreground)]">
                        This sends an instant notification to{' '}
                        <span className="font-semibold">
                            {recipients === null ? 'all' : recipients.toLocaleString()}
                        </span>{' '}
                        {recipients === 1 ? 'user' : 'users'}. It can&apos;t be recalled.
                    </p>

                    <div className="rounded-lg bg-[var(--neutral-50)] border border-[var(--border-color)] px-3 py-2.5">
                        <p className="text-sm font-semibold">{title.trim()}</p>
                        <p className="text-sm text-[var(--foreground-muted)] mt-0.5">{message.trim()}</p>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={() => setConfirmOpen(false)}
                            disabled={pending}
                            className="flex-1 py-3 px-4 rounded-lg border border-[var(--border-color)] font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={send}
                            disabled={pending || recipients === null}
                            className="flex-1 py-3 px-4 rounded-lg font-medium text-white bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {pending ? 'Sending…' : `Send now`}
                        </button>
                    </div>
                </div>
            </Modal>
        </Card>
    )
}
