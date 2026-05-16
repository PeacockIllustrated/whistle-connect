'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Undo2 } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

/**
 * Swipe-to-dismiss list for the coach "Declined" section. Mirrors the
 * SwipeableBookingList pattern (touch swipe + 5s undo pill + localStorage
 * persistence) but tailored to the read-only declined-offer summary rows.
 * Dismissal is local-only (these are derived summaries, not deletable rows).
 */

export interface DeclinedOfferItem {
    id: string
    bookingId: string
    matchDate: string
    kickoffTime: string
    venue: string
    refereeName: string | null
    declinedAt: string
}

const SWIPE_THRESHOLD = 100
const STORAGE_KEY = 'wc:dismissedDeclinedOffers'

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

export function SwipeableDeclinedList({ items }: { items: DeclinedOfferItem[] }) {
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissedIds())
    const [dismissed, setDismissed] = useState<DeclinedOfferItem | null>(null)
    const [undoProgress, setUndoProgress] = useState(100)

    const visibleItems = useMemo(
        () => items.filter(i => !dismissedIds.has(i.id)),
        [items, dismissedIds],
    )

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

    const startUndoTimer = useCallback((item: DeclinedOfferItem) => {
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
            next.delete(dismissed.id)
            writeDismissedIds(next)
            return next
        })
        setDismissed(null)
    }, [dismissed, clearUndoTimers])

    const dismissItem = useCallback((id: string) => {
        const item = visibleItems.find(i => i.id === id)
        if (!item) return
        setDismissed(null)
        clearUndoTimers()
        setDismissedIds(prev => {
            const next = new Set(prev)
            next.add(id)
            writeDismissedIds(next)
            return next
        })
        startUndoTimer(item)
    }, [visibleItems, clearUndoTimers, startUndoTimer])

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

        if (!swipeStateRef.current.locked && Math.abs(deltaY) > Math.abs(deltaX)) {
            swipeStateRef.current = null
            touchStartRef.current = null
            return
        }

        swipeStateRef.current.locked = true
        swipeStateRef.current.deltaX = deltaX

        const el = e.currentTarget as HTMLElement
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
            const direction = state.deltaX > 0 ? 1 : -1
            el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out'
            el.style.transform = `translateX(${direction * 400}px)`
            el.style.opacity = '0'

            setTimeout(() => {
                dismissItem(state.id)
                el.style.transform = ''
                el.style.opacity = ''
                el.style.transition = ''
            }, 200)
        } else {
            el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out'
            el.style.transform = 'translateX(0)'
            el.style.opacity = '1'
            setTimeout(() => { el.style.transition = '' }, 200)
        }

        touchStartRef.current = null
        swipeStateRef.current = null
    }, [dismissItem])

    if (visibleItems.length === 0 && !dismissed) return null

    return (
        <>
            <div className="space-y-2">
                {visibleItems.map((item) => (
                    <div
                        key={item.id}
                        onTouchStart={(e) => handleTouchStart(e, item.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{ willChange: 'transform, opacity' }}
                    >
                        <Link
                            href={`/app/bookings/${item.bookingId}`}
                            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-red-50/50 hover:bg-red-50 transition-colors"
                        >
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-red-700">
                                    {new Date(item.matchDate).getDate()}
                                </span>
                                <span className="text-[10px] text-red-500 uppercase">
                                    {new Date(item.matchDate).toLocaleDateString('en', { month: 'short' })}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.venue}</p>
                                <p className="text-xs text-[var(--foreground-muted)]">
                                    {item.refereeName ? <span className="font-medium">{item.refereeName}</span> : 'A referee'}
                                    {' · '}declined{item.declinedAt ? ` ${formatDate(item.declinedAt)}` : ''}
                                </p>
                            </div>
                            <span className="text-xs text-[var(--foreground-muted)] flex-shrink-0">
                                {formatTime(item.kickoffTime)}
                            </span>
                        </Link>
                    </div>
                ))}
            </div>

            {dismissed && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <button
                        onClick={handleUndo}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--foreground)] text-white rounded-full shadow-lg active:scale-95 transition-transform"
                    >
                        <Undo2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Removed from list</span>
                        <span className="text-sm font-semibold text-white/80">Undo</span>
                    </button>
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
