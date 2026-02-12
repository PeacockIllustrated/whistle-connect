import { createClient } from '@/lib/supabase/server'
import { ThreadListClient, ThreadListItem } from '@/components/app/ThreadListClient'

export default async function MessagesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Get threads the user participates in
    const { data: participations } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)

    let threads: ThreadListItem[] = []

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
                        (p: { profile_id: string }) => p.profile_id !== user.id
                    )

                    return {
                        id: thread.id,
                        updated_at: thread.updated_at,
                        booking: thread.booking,
                        other_participant: otherParticipant?.profile || null,
                        last_message: messages?.[0] || null,
                        unread_count: count || 0,
                    } as ThreadListItem
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

            {/* Thread List - real-time client component */}
            <ThreadListClient
                initialThreads={threads}
                currentUserId={user.id}
            />
        </div>
    )
}
