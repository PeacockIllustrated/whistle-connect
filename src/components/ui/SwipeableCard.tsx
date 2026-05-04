'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Archive } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwipeableCardProps {
    children: ReactNode
    /** Fired after the user swipes past the threshold and the card slides off. */
    onArchive: () => void | Promise<void>
    /** Renders the card without any swipe behaviour. */
    disabled?: boolean
    className?: string
    /** Label shown on the reveal background. Defaults to "Archive". */
    actionLabel?: string
}

const SWIPE_THRESHOLD = 96
const DIRECTION_DETECT_PX = 8
const SLIDE_OUT_DISTANCE = 480

/**
 * Wraps a card with horizontal swipe-to-archive. Left-swipe past the
 * threshold triggers onArchive(); shorter drags spring back.
 *
 * Implementation notes:
 * - Direction is locked on first meaningful pointer move (horizontal vs
 *   vertical) so vertical scrolling isn't hijacked on touch devices.
 * - Pointer events cover both touch and mouse; pointer capture keeps the
 *   gesture alive if the finger drifts off the card mid-swipe.
 */
export function SwipeableCard({
    children,
    onArchive,
    disabled,
    className,
    actionLabel = 'Archive',
}: SwipeableCardProps) {
    const [dx, setDx] = useState(0)
    const [animating, setAnimating] = useState(false)
    const startX = useRef<number | null>(null)
    const startY = useRef<number | null>(null)
    const direction = useRef<'h' | 'v' | null>(null)
    // Set when a horizontal drag completed — swallows the synthetic click
    // that fires after pointerup so a wrapped <Link> doesn't navigate.
    const swallowNextClick = useRef(false)

    if (disabled) {
        return <div className={className}>{children}</div>
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (animating) return
        startX.current = e.clientX
        startY.current = e.clientY
        direction.current = null
        setAnimating(false)
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (startX.current == null || startY.current == null) return
        const moveX = e.clientX - startX.current
        const moveY = e.clientY - startY.current

        if (!direction.current) {
            if (Math.abs(moveX) < DIRECTION_DETECT_PX && Math.abs(moveY) < DIRECTION_DETECT_PX) return
            direction.current = Math.abs(moveX) > Math.abs(moveY) ? 'h' : 'v'
        }
        if (direction.current === 'v') return

        setDx(Math.min(0, moveX))
    }

    const onPointerUp = () => {
        const wasHorizontal = direction.current === 'h'
        startX.current = null
        startY.current = null
        direction.current = null

        if (!wasHorizontal) {
            setDx(0)
            return
        }

        // Any horizontal gesture should swallow the click that follows
        swallowNextClick.current = true

        if (-dx > SWIPE_THRESHOLD) {
            setAnimating(true)
            setDx(-SLIDE_OUT_DISTANCE)
            window.setTimeout(async () => {
                try {
                    await onArchive()
                } finally {
                    setAnimating(false)
                    setDx(0)
                }
            }, 200)
        } else {
            setAnimating(true)
            setDx(0)
            window.setTimeout(() => setAnimating(false), 200)
        }
    }

    const revealOpacity = Math.min(1, -dx / SWIPE_THRESHOLD)
    const isDragging = direction.current === 'h' && !animating

    return (
        <div className={cn('relative overflow-hidden rounded-xl touch-pan-y', className)}>
            {/* Reveal background */}
            <div
                className="absolute inset-0 flex items-center justify-end pr-6 bg-red-500 rounded-xl"
                style={{ opacity: revealOpacity }}
                aria-hidden
            >
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Archive className="w-4 h-4" />
                    <span>{actionLabel}</span>
                </div>
            </div>
            {/* Card content */}
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClickCapture={(e) => {
                    if (swallowNextClick.current) {
                        e.preventDefault()
                        e.stopPropagation()
                        swallowNextClick.current = false
                    }
                }}
                className={cn(
                    'relative will-change-transform',
                    animating && 'transition-transform duration-200 ease-out',
                    isDragging && 'select-none'
                )}
                style={{ transform: `translateX(${dx}px)` }}
            >
                {children}
            </div>
        </div>
    )
}
