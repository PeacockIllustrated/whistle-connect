'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { BookingCardCompact } from '@/components/app/BookingCard'
import type { BookingWithDetails } from '@/lib/types'
import { Undo2 } from 'lucide-react'

const SWIPE_THRESHOLD = 100
const STORAGE_KEY = 'wc:homeDismissedBookings'

function readDismissedIds(): Set<string> {
    if (typeof window === 'undefined') return new Set()
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return new Set()
        const arr = JSON.parse(raw)
        return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === 'string')) : new Set()
    } catch {
        return new Set()
    }
}

function writeDismissedIds(ids: Set<string>) {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)))
    } catch {
        // localStorage may be disabled — silent
    }
}

interface DismissedItem {
    booking: BookingWithDetails
    index: number
}

export function SwipeableBookingList({ bookings }: { bookings: BookingWithDetails[] }) {
    // Track dismissed booking IDs as state, hydrated from localStorage on first render.
    // Visible bookings are derived from props + this set, so no setState-in-effect.
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissedIds())
    const [dismissed, setDismissed] = useState<DismissedItem | null>(null)

    // Derived: only the bookings that are still in the server-provided list and not dismissed.
    const visibleBookings = useMemo(
        () => bookings.filter(b => !dismissedIds.has(b.id)),
        [bookings, dismissedIds],
    )
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
        setDismissedIds(prev => {
            const next = new Set(prev)
            next.delete(dismissed.booking.id)
            writeDismissedIds(next)
            return next
        })
        setDismissed(null)
    }, [dismissed, clearUndoTimers])

    const dismissBooking = useCallback((id: string) => {
        const booking = visibleBookings.find(b => b.id === id)
        const index = visibleBookings.findIndex(b => b.id === id)
        if (!booking || index === -1) return

        // If there's already a dismissed item, finalize it
        setDismissed(null)
        clearUndoTimers()

        setDismissedIds(prev => {
            const next = new Set(prev)
            next.add(id)
            writeDismissedIds(next)
            return next
        })

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
