'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Shuffle, Share2, Check, Trash2, ExternalLink, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { addParticipant, removeParticipant, runDraw, deleteSweepstake } from '@/lib/world-cup/actions'
import { WC_2026_TEAMS } from '@/lib/world-cup/teams-2026'
import { isoForFifa } from '@/lib/world-cup/flags'
import { FlagImage } from '@/components/world-cup/TeamBits'

// ── Draft editor (before the draw) ───────────────────────────────────────────

export function DraftEditor({
    sweepstakeId,
    entries,
}: {
    sweepstakeId: string
    entries: { id: string; name: string }[]
}) {
    const router = useRouter()
    const [newName, setNewName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [drawing, setDrawing] = useState(false)

    async function add() {
        const name = newName.trim()
        if (!name) return
        setBusy(true)
        const res = await addParticipant(sweepstakeId, name)
        setBusy(false)
        if (res?.error) return setError(res.error)
        setNewName('')
        router.refresh()
    }

    async function remove(entryId: string) {
        const res = await removeParticipant(entryId)
        if (res?.error) return setError(res.error)
        router.refresh()
    }

    async function draw() {
        if (entries.length < 2) return setError('Add at least two players first')
        setError('')
        setDrawing(true)
        const res = await runDraw(sweepstakeId)
        if (res?.error) {
            setDrawing(false)
            return setError(res.error)
        }
        // Let the reveal animation play, then load the leaderboard.
        setTimeout(() => router.refresh(), 1600)
    }

    return (
        <div>
            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold text-[var(--foreground)]">Players ({entries.length})</h2>
                    <span className="text-xs text-[var(--foreground-muted)]">48 teams to share out</span>
                </div>

                <ul className="space-y-2">
                    {entries.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--background-soft)] px-3 py-2">
                            <span className="truncate text-sm font-medium text-[var(--foreground)]">{e.name}</span>
                            <button
                                onClick={() => remove(e.id)}
                                className="text-[var(--foreground-muted)] hover:text-red-600"
                                aria-label={`Remove ${e.name}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="mt-3 flex items-center gap-2">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                        placeholder="Add a player"
                        className="flex-1"
                    />
                    <Button type="button" onClick={add} loading={busy} variant="secondary" icon={<Plus className="h-4 w-4" />}>
                        Add
                    </Button>
                </div>
            </div>

            <div className="mt-5">
                <Button type="button" onClick={draw} fullWidth size="lg" variant="accent" icon={<Shuffle className="h-5 w-5" />}>
                    Run the draw
                </Button>
                <p className="mt-2 text-center text-xs text-[var(--foreground-muted)]">
                    Teams are dealt out at random, as evenly as possible.
                </p>
            </div>

            <AnimatePresence>{drawing && <DrawOverlay />}</AnimatePresence>
        </div>
    )
}

// ── The draw reveal animation ────────────────────────────────────────────────

function DrawOverlay() {
    const [i, setI] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setI((n) => (n + 1) % WC_2026_TEAMS.length), 70)
        return () => clearInterval(id)
    }, [])
    const team = WC_2026_TEAMS[i]

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--wc-ink)]/95 px-6 text-center"
        >
            <motion.span
                animate={{ rotate: [0, 12, -12, 0] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
                className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wc-red)] text-white"
            >
                <Shuffle className="h-8 w-8" />
            </motion.span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-white/60">Drawing the teams</p>
            <motion.div
                key={team.code}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-3 flex items-center gap-3"
            >
                <FlagImage countryCode={isoForFifa(team.code)} code={team.code} height={30} />
                <span className="wc-display text-4xl sm:text-5xl text-white">{team.name}</span>
            </motion.div>
        </motion.div>
    )
}

// ── Share bar (after the draw) ───────────────────────────────────────────────

export function ShareBar({ shareId }: { shareId: string }) {
    const [copied, setCopied] = useState(false)
    const [url, setUrl] = useState('')

    useEffect(() => {
        setUrl(`${window.location.origin}/world-cup/s/${shareId}`)
    }, [shareId])

    async function copy() {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            /* clipboard may be blocked; the field is selectable as a fallback */
        }
    }

    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--background-soft)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <Share2 className="h-4 w-4 text-[var(--wc-red)]" /> Share the live leaderboard
            </div>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Anyone with this link can follow along — no account needed.</p>
            <div className="mt-3 flex items-center gap-2">
                <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-h-[40px] flex-1 rounded-lg border border-[var(--border-color)] bg-white px-3 text-sm text-[var(--foreground-muted)]"
                />
                <Button type="button" onClick={copy} variant="primary" icon={copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}>
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
                    Open public page <ExternalLink className="h-3 w-3" />
                </a>
            )}
        </div>
    )
}

// ── Organiser actions (after the draw) ───────────────────────────────────────

export function ManageActions({ sweepstakeId }: { sweepstakeId: string }) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)

    async function redraw() {
        if (!confirm('Re-draw the teams? Everyone will be reassigned at random.')) return
        setBusy(true)
        await runDraw(sweepstakeId)
        setBusy(false)
        router.refresh()
    }

    async function del() {
        if (!confirm('Delete this sweepstake for everyone? This cannot be undone.')) return
        setBusy(true)
        const res = await deleteSweepstake(sweepstakeId)
        if (res?.success) router.push('/world-cup/sweepstake')
        else setBusy(false)
    }

    return (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-color)] pt-4">
            <button onClick={redraw} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-50">
                <Trophy className="h-4 w-4" /> Re-draw teams
            </button>
            <button onClick={del} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Delete sweepstake
            </button>
        </div>
    )
}
