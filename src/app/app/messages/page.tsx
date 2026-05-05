import { createClient } from '@/lib/supabase/server'
import { ThreadListClient, ThreadListItem } from '@/components/app/ThreadListClient'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type View = 'active' | 'archived'

export default async function MessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string }>
}) {
    const { view: viewParam } = await searchParams
    const view: View = viewParam === 'archived' ? 'archived' : 'active'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Fetch the viewer's row from thread_participants — including archived_at
    // so we can decorate each thread with the viewer's archive state and
    // filter on it.
    const { data: participations } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at, archived_at')
        .eq('profile_id', user.id)

    let threads: ThreadListItem[] = []
    let activeCount = 0
    let archivedCount = 0

    if (participations && participations.length > 0) {
        // Counts power the tab badges so the user can see at a glance how
        // many archived items exist (the "tray" affordance).
        for (const p of participations) {
            if (p.archived_at) archivedCount++
            else activeCount++
        }

        // Filter participation rows by view so we only fetch the threads we
        // intend to render.
        const visibleParticipations = participations.filter((p) =>
            view === 'archived' ? p.archived_at : !p.archived_at
        )

        if (visibleParticipations.length > 0) {
            const threadIds = visibleParticipations.map((p) => p.thread_id)

            const { data } = await supabase
                .from('threads')
                .select(`
                    *,
                    booking:bookings(id, ground_name, location_postcode, match_date, status),
                    participants:thread_participants(
                        profile_id,
                        profile:profiles(id, full_name, role, avatar_url)
                    )
                `)
                .in('id', threadIds)
                .order('updated_at', { ascending: false })

            if (data) {
                const allThreads = await Promise.all(
                    data.map(async (thread) => {
                        const { data: messages } = await supabase
                            .from('messages')
                            .select('*')
                            .eq('thread_id', thread.id)
                            .order('created_at', { ascending: false })
                            .limit(1)

                        const participation = visibleParticipations.find(
                            (p) => p.thread_id === thread.id
                        )
                        const lastReadAt = participation?.last_read_at || '1970-01-01'

                        const { count } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('thread_id', thread.id)
                            .gt('created_at', lastReadAt)

                        const otherParticipant = thread.participants?.find(
                            (p: { profile_id: string }) => p.profile_id !== user.id
                        )

                        return {
                            id: thread.id,
                            updated_at: thread.updated_at,
                            archived_at: participation?.archived_at ?? null,
                            booking: thread.booking,
                            other_participant: otherParticipant?.profile || null,
                            last_message: messages?.[0] || null,
                            unread_count: count || 0,
                        } as ThreadListItem
                    })
                )

                threads = allThreads.filter((t) => {
                    const status = t.booking?.status
                    return status && !['draft'].includes(status)
                })
            }
        }
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Messages</h1>
                <p className="text-[var(--foreground-muted)]">
                    Chat with coaches and referees
                </p>
            </div>

            {/* View tabs (Active / Archived). The Archived tab is the
                "recovery tray" — accidentally-archived threads land here. */}
            <div className="mb-4 grid grid-cols-2 gap-2 p-1 bg-[var(--background-soft)] rounded-2xl border border-[var(--border-color)]">
                <Tab href="/app/messages" active={view === 'active'} label="Active" count={activeCount} />
                <Tab
                    href="/app/messages?view=archived"
                    active={view === 'archived'}
                    label="Archived"
                    count={archivedCount}
                />
            </div>

            <ThreadListClient
                initialThreads={threads}
                currentUserId={user.id}
                view={view}
            />
        </div>
    )
}

function Tab({
    href,
    active,
    label,
    count,
}: {
    href: string
    active: boolean
    label: string
    count: number
}) {
    return (
        <Link
            href={href}
            scroll={false}
            className={cn(
                'py-2.5 px-3 rounded-xl text-center font-semibold text-sm transition-colors flex items-center justify-center gap-2',
                active
                    ? 'bg-white text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--foreground-muted)] hover:bg-white/50'
            )}
        >
            <span>{label}</span>
            <span
                className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold',
                    active
                        ? 'bg-[var(--neutral-100)] text-[var(--foreground-muted)]'
                        : 'bg-[var(--neutral-200)] text-[var(--foreground-muted)]'
                )}
            >
                {count}
            </span>
        </Link>
    )
}
