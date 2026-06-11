import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { Leaderboard } from '@/components/world-cup/Leaderboard'
import { getSweepstakeForOrganiser } from '@/lib/world-cup/data'
import { DraftEditor, ShareBar, ManageActions } from './ManageClient'

export const metadata: Metadata = { title: 'Manage sweepstake | Whistle Connect' }

export default async function ManageSweepstakePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const detail = await getSweepstakeForOrganiser(id)
    if (!detail || !detail.isOrganiser) notFound()

    const { sweepstake, leaderboard } = detail
    const drawn = sweepstake.status !== 'draft'

    return (
        <WcShell>
            <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <Link href="/world-cup/sweepstake" className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] hover:underline">
                    <ArrowLeft className="h-4 w-4" /> Your sweepstakes
                </Link>

                <h1 className="mt-3 text-2xl font-bold text-[var(--foreground)]">{sweepstake.name}</h1>

                {drawn ? (
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
                        <DraftEditor
                            sweepstakeId={sweepstake.id}
                            entries={leaderboard.map((r) => ({ id: r.entry.id, name: r.entry.participant_name }))}
                        />
                    </div>
                )}
            </div>
        </WcShell>
    )
}
