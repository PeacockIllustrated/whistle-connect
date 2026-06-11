import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { Leaderboard } from '@/components/world-cup/Leaderboard'
import { getSweepstakeForOrganiser } from '@/lib/world-cup/data'
import { DraftEditor, ShareBar, ManageActions } from './ManageClient'
import { ManualAssignPanel } from './ManualAssignPanel'

export const metadata: Metadata = { title: 'Manage sweepstake | Whistle Connect' }

export default async function ManageSweepstakePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ edit?: string }>
}) {
    const { id } = await params
    const { edit } = await searchParams
    const detail = await getSweepstakeForOrganiser(id)
    if (!detail || !detail.isOrganiser) notFound()

    const { sweepstake, leaderboard } = detail
    const drawn = sweepstake.status !== 'draft'
    const editingTeams = drawn && edit === 'manual'

    const entries = leaderboard.map((r) => ({ id: r.entry.id, name: r.entry.participant_name }))
    const initialAssign = Object.fromEntries(leaderboard.map((r) => [r.entry.id, r.teams.map((t) => t.code)]))

    return (
        <WcShell>
            <div className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-8">
                <Link href="/world-cup/sweepstake" className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] hover:underline">
                    <ArrowLeft className="h-4 w-4" /> Your sweepstakes
                </Link>

                <h1 className="wc-display mt-3 text-3xl sm:text-4xl text-[var(--foreground)]">{sweepstake.name}</h1>

                {editingTeams ? (
                    <div className="mt-5">
                        <ManualAssignPanel
                            sweepstakeId={sweepstake.id}
                            entries={entries}
                            initial={initialAssign}
                            cancelHref={`/world-cup/sweepstake/${sweepstake.id}`}
                        />
                    </div>
                ) : drawn ? (
                    <>
                        <div className="mt-4">
                            <ShareBar shareId={sweepstake.share_id} />
                        </div>
                        <div className="mt-6">
                            <Leaderboard rows={leaderboard} />
                        </div>
                        <div className="mt-6">
                            <ManageActions sweepstakeId={sweepstake.id} />
                        </div>
                    </>
                ) : (
                    <div className="mt-5">
                        <DraftEditor sweepstakeId={sweepstake.id} entries={entries} />
                    </div>
                )}
            </div>
        </WcShell>
    )
}
