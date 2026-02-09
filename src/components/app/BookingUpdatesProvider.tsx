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
}

const BookingUpdatesContext = createContext<BookingUpdatesContextValue>({
    revision: 0,
    subscribe: () => () => {},
})

export function useBookingUpdates() {
    return useContext(BookingUpdatesContext)
}

interface BookingUpdatesProviderProps {
    userId: string
    children: React.ReactNode
}

export function BookingUpdatesProvider({ userId, children }: BookingUpdatesProviderProps) {
    const supabase = createClient()
    const [revision, setRevision] = useState(0)
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
        <BookingUpdatesContext.Provider value={{ revision, subscribe }}>
            {children}
        </BookingUpdatesContext.Provider>
    )
}
