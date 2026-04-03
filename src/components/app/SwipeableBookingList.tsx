'use client'

import { useState, useRef, useCallback } from 'react'
import { BookingCardCompact } from '@/components/app/BookingCard'
import type { BookingWithDetails } from '@/lib/types'
import { Undo2 } from 'lucide-react'

const SWIPE_THRESHOLD = 100

interface DismissedItem {
    booking: BookingWithDetails
    index: number
}

export function SwipeableBookingList({ bookings }: { bookings: BookingWithDetails[] }) {
    const [visibleBookings, setVisibleBookings] = useState(bookings)
    const [dismissed, setDismissed] = useState<DismissedItem | null>(null)
    const [undoProgress, setUndoProgress] = useState(100)
    const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    const swipeStateRef = useRef<{ id: string; deltaX: number; locked: boolean } | null>(null)

    const clearUndoTimers = useCallback(() => {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        if (progressRef.current) clearInterval(progressRef.current)
        undoTimerRef.current = null
        progressRef.current = null
    }, [])

    const startUndoTimer = useCallback((item: DismissedItem) => {
        clearUndoTimers()
        setDismissed(item)
        setUndoProgress(100)

        const duration = 5000
        const interval = 50
        const step = (interval / duration) * 100

        progressRef.current = setInterval(() => {
            setUndoProgress(prev => {
                const next = prev - step
                return next < 0 ? 0 : next
            })
        }, interval)

        undoTimerRef.current = setTimeout(() => {
            clearUndoTimers()
            setDismissed(null)
        }, duration)
    }, [clearUndoTimers])

    const handleUndo = useCallback(() => {
        if (!dismissed) return
        clearUndoTimers()
        setVisibleBookings(prev => {
            const next = [...prev]
            next.splice(dismissed.index, 0, dismissed.booking)
            return next
        })
        setDismissed(null)
    }, [dismissed, clearUndoTimers])

    const dismissBooking = useCallback((id: string) => {
        const index = visibleBookings.findIndex(b => b.id === id)
        if (index === -1) return
        const booking = visibleBookings[index]

        // If there's already a dismissed item, finalize it
        setDismissed(null)
        clearUndoTimers()

        setVisibleBookings(prev => prev.filter(b => b.id !== id))
        startUndoTimer({ booking, index })
    }, [visibleBookings, clearUndoTimers, startUndoTimer])

    const handleTouchStart = useCallback((e: React.TouchEvent, id: string) => {
        const touch = e.touches[0]
        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        swipeStateRef.current = { id, deltaX: 0, locked: false }
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || !swipeStateRef.current) return
        const touch = e.touches[0]
        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y

        // If vertical scroll is dominant, cancel swipe
        if (!swipeStateRef.current.locked && Math.abs(deltaY) > Math.abs(deltaX)) {
            swipeStateRef.current = null
            touchStartRef.current = null
            return
        }

        swipeStateRef.current.locked = true
        swipeStateRef.current.deltaX = deltaX

        const el = (e.currentTarget as HTMLElement)
        el.style.transform = `translateX(${deltaX}px)`
        el.style.opacity = `${Math.max(0, 1 - Math.abs(deltaX) / 300)}`
        el.style.transition = 'none'
    }, [])

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const state = swipeStateRef.current
        const el = e.currentTarget as HTMLElement

        if (!state) {
            el.style.transform = ''
            el.style.opacity = ''
            el.style.transition = ''
            return
        }

        if (Math.abs(state.deltaX) > SWIPE_THRESHOLD) {
            // Swipe past threshold — animate off and dismiss
            const direction = state.deltaX > 0 ? 1 : -1
            el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out'
            el.style.transform = `translateX(${direction * 400}px)`
            el.style.opacity = '0'

            setTimeout(() => {
                dismissBooking(state.id)
                el.style.transform = ''
                el.style.opacity = ''
                el.style.transition = ''
            }, 200)
        } else {
            // Snap back
            el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out'
            el.style.transform = 'translateX(0)'
            el.style.opacity = '1'

            setTimeout(() => {
                el.style.transition = ''
            }, 200)
        }

        touchStartRef.current = null
        swipeStateRef.current = null
    }, [dismissBooking])

    if (visibleBookings.length === 0 && !dismissed) return null

    return (
        <>
            <div className="space-y-2">
                {visibleBookings.map((booking) => (
                    <div
                        key={booking.id}
                        onTouchStart={(e) => handleTouchStart(e, booking.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{ willChange: 'transform, opacity' }}
                    >
                        <BookingCardCompact booking={booking} />
                    </div>
                ))}
            </div>

            {/* Undo Pill */}
            {dismissed && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <button
                        onClick={handleUndo}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--foreground)] text-white rounded-full shadow-lg active:scale-95 transition-transform"
                    >
                        <Undo2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Booking dismissed</span>
                        <span className="text-sm font-semibold text-white/80">Undo</span>
                    </button>
                    {/* Progress bar */}
                    <div className="mt-1 mx-auto w-3/4 h-0.5 rounded-full bg-white/20 overflow-hidden">
                        <div
                            className="h-full bg-white/60 rounded-full transition-none"
                            style={{ width: `${undoProgress}%` }}
                        />
                    </div>
                </div>
            )}
        </>
    )
}
