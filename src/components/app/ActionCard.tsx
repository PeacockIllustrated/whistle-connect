'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface ActionCardProps {
    href?: string
    onClick?: () => void
    icon: ReactNode
    title: string
    subtitle?: string
    variant?: 'primary' | 'secondary' | 'glass' | 'outline' | 'success'
    disabled?: boolean
    badge?: string | number
    className?: string
}

export function ActionCard({
    href,
    onClick,
    icon,
    title,
    subtitle,
    variant = 'secondary',
    disabled = false,
    badge,
    className,
}: ActionCardProps) {
    const variants = {
        primary: `
      bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary)] to-[var(--brand-primary-dark)]
      text-white
      shadow-lg shadow-[var(--brand-primary)]/20
      hover:shadow-xl hover:shadow-[var(--brand-primary)]/30
      hover:-translate-y-1
    `,
        secondary: `
      bg-[var(--background-elevated)]
      border border-[var(--border-color)]
      text-[var(--foreground)]
      hover:border-[var(--color-primary)] hover:shadow-md
      hover:-translate-y-0.5
    `,
        glass: `
      bg-white/10 backdrop-blur-lg
      border border-white/20
      text-white
      hover:bg-white/20
    `,
        outline: `
      bg-transparent
      border-2 border-[var(--border-color-strong)]
      text-[var(--foreground)]
      hover:border-[var(--color-primary)] hover:bg-[var(--neutral-50)]
    `,
        success: `
      bg-gradient-to-br from-emerald-500 via-emerald-500 to-emerald-600
      text-white
      shadow-lg shadow-emerald-500/20
      hover:shadow-xl hover:shadow-emerald-500/30
      hover:-translate-y-1
    `,
    }

    const content = (
        <>
            {/* Icon Container */}
            <div className={cn(
                'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
                (variant === 'primary' || variant === 'success')
                    ? 'bg-white/20'
                    : 'bg-gradient-to-br from-[var(--brand-primary)]/10 to-[var(--brand-primary)]/5'
            )}>
                <span className={cn(
                    (variant === 'primary' || variant === 'success') ? 'text-white' : 'text-[var(--brand-primary)]'
                )}>
                    {icon}
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{title}</h3>
                    {badge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--brand-accent)] text-white rounded-full">
                            {badge}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className={cn(
                        'text-sm truncate mt-0.5',
                        (variant === 'primary' || variant === 'success') ? 'text-white/70' : 'text-[var(--foreground-muted)]'
                    )}>
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Arrow */}
            <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                'group-hover:translate-x-1',
                (variant === 'primary' || variant === 'success') ? 'bg-white/10' : 'bg-[var(--neutral-100)]'
            )}>
                <ChevronRight className={cn(
                    'w-4 h-4',
                    (variant === 'primary' || variant === 'success') ? 'text-white' : 'text-[var(--neutral-500)]'
                )} />
            </div>
        </>
    )

    const classes = cn(
        'group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer touch-target',
        variants[variant],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
    )

    if (disabled) {
        return <div className={classes}>{content}</div>
    }

    if (href) {
        return <Link href={href} className={classes}>{content}</Link>
    }

    return (
        <button onClick={onClick} className={cn(classes, 'w-full text-left')}>
            {content}
        </button>
    )
}

// Access Lane - Full-width quick access button
interface AccessLaneProps {
    href?: string
    onClick?: () => void
    icon: ReactNode
    title: string
    variant?: 'referee' | 'coach' | 'default'
    className?: string
}

export function AccessLane({
    href,
    onClick,
    icon,
    title,
    variant = 'default',
    className,
}: AccessLaneProps) {
    const variants = {
        coach: 'from-[var(--wc-coach-blue)] to-[var(--wc-blue)] hover:from-[var(--brand-primary-dark)] hover:to-[var(--wc-coach-blue)]',
        referee: 'from-[var(--wc-ref-red)] to-[#a31214] hover:from-[#a31214] hover:to-[#8c1012]',
        default: 'from-[var(--neutral-600)] to-[var(--neutral-700)] hover:from-[var(--neutral-700)] hover:to-[var(--neutral-800)]',
    }

    const content = (
        <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                {icon}
            </span>
            <span className="font-semibold text-white">{title}</span>
            <ChevronRight className="w-4 h-4 text-white/70 ml-auto group-hover:translate-x-1 transition-transform" />
        </div>
    )

    const classes = cn(
        'group block w-full p-3 rounded-xl bg-gradient-to-r transition-all duration-200 shadow-md hover:shadow-lg',
        variants[variant],
        className
    )

    if (href) {
        return <Link href={href} className={classes}>{content}</Link>
    }

    return <button onClick={onClick} className={classes}>{content}</button>
}
