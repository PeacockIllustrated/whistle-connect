'use client'

import { useState, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IconAnimation = 'bounce' | 'pop' | 'wiggle' | 'ring' | 'send' | 'pulse-soft'

interface AnimatedIconProps {
    icon: LucideIcon
    className?: string
    size?: number
    strokeWidth?: number
    animation?: IconAnimation
    /** 'tap' = animate on click, 'hover' = animate on hover */
    trigger?: 'tap' | 'hover'
    fill?: string
    /** Pass extra props to the SVG */
    [key: string]: any
}

/**
 * Wraps any Lucide icon with a CSS micro-animation on interaction.
 *
 * Usage:
 *   <AnimatedIcon icon={Home} animation="bounce" trigger="tap" />
 *   <AnimatedIcon icon={Bell} animation="ring" trigger="tap" className="w-5 h-5" />
 */
export function AnimatedIcon({
    icon: Icon,
    className,
    size,
    strokeWidth,
    animation = 'pop',
    trigger = 'tap',
    fill,
    ...rest
}: AnimatedIconProps) {
    const [animating, setAnimating] = useState(false)

    const triggerAnimation = useCallback(() => {
        setAnimating(true)
    }, [])

    const handleAnimationEnd = useCallback(() => {
        setAnimating(false)
    }, [])

    const animClass = animating ? `icon-animate-${animation}` : ''

    return (
        <span
            className={cn('inline-flex', animClass)}
            onClick={trigger === 'tap' ? triggerAnimation : undefined}
            onMouseEnter={trigger === 'hover' ? triggerAnimation : undefined}
            onAnimationEnd={handleAnimationEnd}
        >
            <Icon
                className={className}
                size={size}
                strokeWidth={strokeWidth}
                fill={fill}
                {...rest}
            />
        </span>
    )
}
