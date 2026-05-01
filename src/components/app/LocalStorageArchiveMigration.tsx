'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { migrateRefereeArchiveFromLocalStorage } from '@/app/app/bookings/actions'

const STORAGE_KEY = 'wc:refereeArchivedBookings'

export function LocalStorageArchiveMigration() {
    const router = useRouter()

    useEffect(() => {
        let cancelled = false

        async function flush() {
            if (typeof window === 'undefined') return
            let ids: string[] = []
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY)
                if (!raw) return
                const parsed = JSON.parse(raw)
                if (!Array.isArray(parsed)) {
                    window.localStorage.removeItem(STORAGE_KEY)
                    return
                }
                ids = parsed.filter((v: unknown): v is string => typeof v === 'string')
            } catch {
                window.localStorage.removeItem(STORAGE_KEY)
                return
            }

            if (ids.length === 0) {
                window.localStorage.removeItem(STORAGE_KEY)
                return
            }

            const res = await migrateRefereeArchiveFromLocalStorage(ids)
            if (cancelled) return
            const errored = 'error' in res && res.error
            if (!errored) {
                window.localStorage.removeItem(STORAGE_KEY)
                const migrated = ('migrated' in res ? res.migrated : 0) ?? 0
                if (migrated > 0) router.refresh()
            }
        }

        flush()
        return () => {
            cancelled = true
        }
    }, [router])

    return null
}
