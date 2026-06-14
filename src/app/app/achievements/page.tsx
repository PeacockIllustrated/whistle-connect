import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMyAchievements } from '@/lib/achievements'
import { AchievementsView } from '@/components/achievements/AchievementsView'

export default async function AchievementsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const data = await getMyAchievements()

    return (
        <div className="mx-auto max-w-[var(--content-max-width)] px-4 py-6 pb-24">
            <div className="mb-5 flex items-center gap-3">
                <Link
                    href="/app/profile"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--background-elevated)] hover:bg-[var(--neutral-50)]"
                    aria-label="Back to profile"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-xl font-bold">Achievements</h1>
            </div>
            <AchievementsView data={data} />
        </div>
    )
}
