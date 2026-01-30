import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, truncate } from '@/lib/utils'

export default async function MessagesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Get threads the user participates in
    const { data: participations } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)

    let threads: any[] = []

    if (participations && participations.length > 0) {
        const threadIds = participations.map(p => p.thread_id)

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
            // Get last message and unread count for each thread
            const allThreads = await Promise.all(
                data.map(async (thread) => {
                    const { data: messages } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('thread_id', thread.id)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    const participation = participations.find(p => p.thread_id === thread.id)
                    const lastReadAt = participation?.last_read_at || '1970-01-01'

                    const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('thread_id', thread.id)
                        .gt('created_at', lastReadAt)

                    // Get other participant
                    const otherParticipant = thread.participants?.find(
                        (p: any) => p.profile_id !== user.id
                    )

                    return {
                        ...thread,
                        last_message: messages?.[0] || null,
                        unread_count: count || 0,
                        other_participant: otherParticipant?.profile,
                    }
                })
            )

            // Filter to only show threads for confirmed bookings
            // We allow system messages to exist, but the thread only appears in the list when confirmed
            threads = allThreads.filter(t => t.booking?.status === 'confirmed')
        }
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Messages</h1>
                <p className="text-[var(--foreground-muted)]">
                    Chat with coaches and referees
                </p>
            </div>

            {/* Thread List */}
            {threads.length > 0 ? (
                <div className="space-y-2">
                    {threads.map((thread) => (
                        <Link
                            key={thread.id}
                            href={`/app/messages/${thread.id}`}
                            className="block card p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--brand-primary)] relative overflow-hidden flex items-center justify-center text-white font-semibold">
                                    {thread.other_participant?.avatar_url ? (
                                        <img
                                            src={thread.other_participant.avatar_url}
                                            alt={thread.other_participant.full_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        thread.other_participant?.full_name?.charAt(0) || '?'
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold truncate">
                                            {thread.other_participant?.full_name || 'Unknown'}
                                        </h3>
                                        {thread.last_message && (
                                            <span className="text-xs text-[var(--foreground-muted)] whitespace-nowrap">
                                                {new Date(thread.last_message.created_at).toLocaleDateString('en', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </span>
                                        )}
                                    </div>

                                    {/* Match reference */}
                                    {thread.booking && (
                                        <p className="text-xs text-[var(--foreground-muted)]">
                                            {thread.booking.ground_name || thread.booking.location_postcode} • {formatDate(thread.booking.match_date)}
                                        </p>
                                    )}

                                    {/* Last message preview */}
                                    {thread.last_message && (
                                        <p className={`text-sm mt-1 truncate ${thread.unread_count > 0 ? 'font-medium text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                            {thread.last_message.kind === 'system' ? (
                                                <span className="italic">{truncate(thread.last_message.body, 50)}</span>
                                            ) : (
                                                truncate(thread.last_message.body, 50)
                                            )}
                                        </p>
                                    )}
                                </div>

                                {/* Unread indicator */}
                                {thread.unread_count > 0 && (
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center">
                                        {thread.unread_count}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    }
                    title="No messages yet"
                    description="Messages will appear here when you have confirmed bookings with referees or coaches"
                />
            )}
        </div>
    )
}
