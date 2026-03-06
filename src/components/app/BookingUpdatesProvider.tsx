'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BookingUpdate {
    table: 'booking_offers' | 'bookings'
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: Record<string, unknown>
    old: Record<string, unknown>
}

interface BookingUpdatesContextValue {
    /** Increments on every relevant change — components can use this to trigger refetches */
    revision: number
    /** Subscribe to raw realtime events */
    subscribe: (callback: (update: BookingUpdate) => void) => () => void
    /** Real-time count of pending offers for the current user (referees only) */
    offerCount: number
}

const BookingUpdatesContext = createContext<BookingUpdatesContextValue>({
    revision: 0,
    subscribe: () => () => {},
    offerCount: 0,
})

export function useBookingUpdates() {
    return useContext(BookingUpdatesContext)
}

interface BookingUpdatesProviderProps {
    userId: string
    initialOfferCount?: number
    children: React.ReactNode
}

export function BookingUpdatesProvider({ userId, initialOfferCount = 0, children }: BookingUpdatesProviderProps) {
    const supabase = createClient()
    const [revision, setRevision] = useState(0)
    const [offerCount, setOfferCount] = useState(initialOfferCount)
    const subscribersRef = useRef<Set<(update: BookingUpdate) => void>>(new Set())

    const subscribe = useCallback((callback: (update: BookingUpdate) => void) => {
        subscribersRef.current.add(callback)
        return () => { subscribersRef.current.delete(callback) }
    }, [])

    useEffect(() => {
        // Listen to booking_offers changes relevant to this user
        const offersChannel = supabase
            .channel('booking-offers-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'booking_offers',
                },
                (payload) => {
                    const update: BookingUpdate = {
                        table: 'booking_offers',
                        eventType: payload.eventType as BookingUpdate['eventType'],
                        new: (payload.new || {}) as Record<string, unknown>,
                        old: (payload.old || {}) as Record<string, unknown>,
                    }
                    subscribersRef.current.forEach(cb => cb(update))
                    setRevision(r => r + 1)

                    // Update offer count for the current user
                    const newRecord = update.new
                    const oldRecord = update.old

                    if (update.eventType === 'INSERT') {
                        // New offer sent to this user
                        if (newRecord.referee_id === userId && newRecord.status === 'sent') {
                            setOfferCount(c => c + 1)
                        }
                    } else if (update.eventType === 'UPDATE') {
                        const wasRelevant = oldRecord.referee_id === userId && oldRecord.status === 'sent'
                        const isRelevant = newRecord.referee_id === userId && newRecord.status === 'sent'

                        if (wasRelevant && !isRelevant) {
                            // Offer was 'sent' to us but is no longer (accepted, declined, etc.)
                            setOfferCount(c => Math.max(0, c - 1))
                        } else if (!wasRelevant && isRelevant) {
                            // Offer became 'sent' to us (unlikely but handle it)
                            setOfferCount(c => c + 1)
                        }
                    } else if (update.eventType === 'DELETE') {
                        if (oldRecord.referee_id === userId && oldRecord.status === 'sent') {
                            setOfferCount(c => Math.max(0, c - 1))
                        }
                    }
                }
            )
            .subscribe()

        // Listen to bookings table changes
        const bookingsChannel = supabase
            .channel('bookings-status-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'bookings',
                },
                (payload) => {
                    const update: BookingUpdate = {
                        table: 'bookings',
                        eventType: 'UPDATE',
                        new: (payload.new || {}) as Record<string, unknown>,
                        old: (payload.old || {}) as Record<string, unknown>,
                    }
                    subscribersRef.current.forEach(cb => cb(update))
                    setRevision(r => r + 1)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(offersChannel)
            supabase.removeChannel(bookingsChannel)
        }
    }, [userId, supabase])

    return (
        <BookingUpdatesContext.Provider value={{ revision, subscribe, offerCount }}>
            {children}
        </BookingUpdatesContext.Provider>
    )
}
