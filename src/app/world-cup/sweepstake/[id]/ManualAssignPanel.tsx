'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, Check, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { setManualAssignments } from '@/lib/world-cup/actions'
import { WC_2026_TEAMS } from '@/lib/world-cup/teams-2026'
import { isoForFifa } from '@/lib/world-cup/flags'
import { FlagImage } from '@/components/world-cup/TeamBits'

const GROUPS = [...new Set(WC_2026_TEAMS.map((t) => t.group))].sort()
const NAME_BY_CODE: Record<string, string> = Object.fromEntries(WC_2026_TEAMS.map((t) => [t.code, t.name]))

/**
 * Manual team distribution - for sweepstakes where people have already picked
 * out of a hat. Assign specific teams to each player; a team can only go to one
 * person. Used both before the first draw and to edit an existing one.
 */
export function ManualAssignPanel({
    sweepstakeId,
    entries,
    initial,
    onCancel,
    cancelHref,
}: {
    sweepstakeId: string
    entries: { id: string; name: string }[]
    initial?: Record<string, string[]>
    onCancel?: () => void
    cancelHref?: string
}) {
    const router = useRouter()
    const [assign, setAssign] = useState<Record<string, string[]>>(() => {
        const base: Record<string, string[]> = {}
        for (const e of entries) base[e.id] = initial?.[e.id] ? [...initial[e.id]] : []
        return base
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const assignedCodes = useMemo(() => new Set(Object.values(assign).flat()), [assign])
    const available = useMemo(() => WC_2026_TEAMS.filter((t) => !assignedCodes.has(t.code)), [assignedCodes])
    const availableByGroup = useMemo(
        () => GROUPS.map((g) => ({ group: g, teams: available.filter((t) => t.group === g) })).filter((x) => x.teams.length),
        [available],
    )

    function addTeam(entryId: string, code: string) {
        if (!code) return
        setAssign((prev) => ({ ...prev, [entryId]: [...(prev[entryId] ?? []), code] }))
    }
    function removeTeam(entryId: string, code: string) {
        setAssign((prev) => ({ ...prev, [entryId]: (prev[entryId] ?? []).filter((c) => c !== code) }))
    }
    function fillRemaining() {
        const pool = [...available]
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
        }
        setAssign((prev) => {
            const next = { ...prev }
            let i = 0
            for (const t of pool) {
                const e = entries[i % entries.length]
                next[e.id] = [...(next[e.id] ?? []), t.code]
                i++
            }
            return next
        })
    }
    function clearAll() {
        setAssign(Object.fromEntries(entries.map((e) => [e.id, []])))
    }

    async function save() {
        setError('')
        setSaving(true)
        const payload = entries.map((e) => ({ entryId: e.id, teamCodes: assign[e.id] ?? [] }))
        const res = await setManualAssignments(sweepstakeId, payload)
        if (res?.error) {
            setError(res.error)
            setSaving(false)
            return
        }
        router.push(`/world-cup/sweepstake/${sweepstakeId}`)
        router.refresh()
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="wc-display text-xl text-[var(--foreground)]">Assign teams manually</h2>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        {assignedCodes.size} of 48 assigned · {available.length} left
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={fillRemaining}
                        disabled={available.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--neutral-100)] disabled:opacity-40"
                    >
                        <Shuffle className="h-3.5 w-3.5" /> Fill rest randomly
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--neutral-100)]"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="space-y-3">
                {entries.map((e) => {
                    const codes = assign[e.id] ?? []
                    return (
                        <div key={e.id} className="rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[var(--foreground)]">{e.name}</span>
                                <span className="text-[11px] text-[var(--foreground-muted)]">{codes.length} team{codes.length === 1 ? '' : 's'}</span>
                            </div>

                            {codes.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {codes.map((code) => (
                                        <span key={code} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--neutral-100)] px-2 py-1 text-sm font-semibold text-[var(--foreground)]">
                                            <FlagImage countryCode={isoForFifa(code)} code={code} height={14} />
                                            {code}
                                            <button type="button" onClick={() => removeTeam(e.id, code)} aria-label={`Remove ${NAME_BY_CODE[code] ?? code}`} className="text-[var(--foreground-muted)] hover:text-red-600">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <select
                                value=""
                                onChange={(ev) => addTeam(e.id, ev.target.value)}
                                className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-white px-2 text-sm text-[var(--foreground)]"
                                aria-label={`Add a team for ${e.name}`}
                            >
                                <option value="">Add a team…</option>
                                {availableByGroup.map((g) => (
                                    <optgroup key={g.group} label={`Group ${g.group}`}>
                                        {g.teams.map((t) => (
                                            <option key={t.code} value={t.code}>{t.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    )
                })}
            </div>

            <div className="mt-5 flex items-center gap-3">
                <Button type="button" onClick={save} loading={saving} size="lg" variant="accent" icon={<Check className="h-5 w-5" />}>
                    Save assignments
                </Button>
                {onCancel ? (
                    <button type="button" onClick={onCancel} className="text-sm font-medium text-[var(--foreground-muted)] hover:underline">
                        Cancel
                    </button>
                ) : cancelHref ? (
                    <Link href={cancelHref} className="text-sm font-medium text-[var(--foreground-muted)] hover:underline">
                        Cancel
                    </Link>
                ) : null}
            </div>
        </div>
    )
}
