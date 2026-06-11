'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createSweepstake } from '@/lib/world-cup/actions'

export function CreateSweepstakeForm() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [players, setPlayers] = useState<string[]>(['', '', '', ''])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const filledCount = players.filter((p) => p.trim()).length

    function updatePlayer(i: number, value: string) {
        setPlayers((prev) => prev.map((p, idx) => (idx === i ? value : p)))
    }
    function addPlayer() {
        setPlayers((prev) => (prev.length >= 48 ? prev : [...prev, '']))
    }
    function removePlayer(i: number) {
        setPlayers((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!name.trim()) return setError('Give your sweepstake a name')
        if (filledCount < 2) return setError('Add at least two players')

        setLoading(true)
        const result = await createSweepstake({ name, participantNames: players })
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        } else if (result?.id) {
            router.push(`/world-cup/sweepstake/${result.id}`)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <Input
                label="Sweepstake name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dad's Sunday League sweep"
                maxLength={80}
                required
            />

            <div>
                <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-[var(--foreground)]">Players</label>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                        <Users className="h-3.5 w-3.5" /> {filledCount} added · 48 teams
                    </span>
                </div>
                <div className="space-y-2">
                    {players.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Input
                                aria-label={`Player ${i + 1}`}
                                value={p}
                                onChange={(e) => updatePlayer(i, e.target.value)}
                                placeholder={`Player ${i + 1}`}
                                className="flex-1"
                            />
                            <button
                                type="button"
                                onClick={() => removePlayer(i)}
                                disabled={players.length <= 2}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--neutral-100)] disabled:opacity-30"
                                aria-label={`Remove player ${i + 1}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={addPlayer}
                    disabled={players.length >= 48}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:underline disabled:opacity-40"
                >
                    <Plus className="h-4 w-4" /> Add another player
                </button>
                {filledCount > 0 && (
                    <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                        Each player will get {Math.floor(48 / Math.max(filledCount, 1))}
                        {48 % filledCount === 0 ? '' : `–${Math.ceil(48 / filledCount)}`} team
                        {Math.ceil(48 / filledCount) === 1 ? '' : 's'}.
                    </p>
                )}
            </div>

            <Button type="submit" fullWidth loading={loading} size="lg" variant="accent">
                Create sweepstake
            </Button>
        </form>
    )
}
