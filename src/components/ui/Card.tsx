'use client'

import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'elevated' | 'glass' | 'gradient' | 'outline'
    padding?: 'none' | 'sm' | 'md' | 'lg'
    hover?: boolean
    glow?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({
        className,
        variant = 'default',
        padding = 'md',
        hover = false,
        glow = false,
        children,
        ...props
    }, ref) => {
        const variants = {
            default: `
        bg-[var(--background-elevated)] 
        border border-[var(--border-color)]
        shadow-sm
      `,
            elevated: `
        bg-[var(--background-elevated)]
        shadow-lg
      `,
            glass: `
        bg-[var(--surface-glass)]
        backdrop-blur-xl
        border border-white/10
      `,
            gradient: `
        bg-gradient-to-br from-[var(--neutral-50)] to-[var(--neutral-100)]
        border border-[var(--border-color)]
      `,
            outline: `
        bg-transparent
        border-2 border-[var(--border-color)]
      `,
        }

        const paddings = {
            none: '',
            sm: 'p-3',
            md: 'p-4',
            lg: 'p-6',
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'rounded-2xl transition-all duration-200',
                    variants[variant],
                    paddings[padding],
                    hover && 'hover:shadow-lg hover:-translate-y-1 cursor-pointer',
                    glow && 'hover:shadow-[var(--shadow-glow)]',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

Card.displayName = 'Card'

// Card Header
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> { }

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn('flex flex-col gap-1.5 mb-4', className)}
            {...props}
        />
    )
)

CardHeader.displayName = 'CardHeader'

// Card Title
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
    as?: 'h1' | 'h2' | 'h3' | 'h4'
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className, as: Component = 'h3', ...props }, ref) => (
        <Component
            ref={ref}
            className={cn('text-lg font-semibold text-[var(--foreground)]', className)}
            {...props}
        />
    )
)

CardTitle.displayName = 'CardTitle'

// Card Description
interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> { }

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
    ({ className, ...props }, ref) => (
        <p
            ref={ref}
            className={cn('text-sm text-[var(--foreground-muted)]', className)}
            {...props}
        />
    )
)

CardDescription.displayName = 'CardDescription'

// Card Footer
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> { }

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn('flex items-center gap-3 mt-4 pt-4 border-t border-[var(--border-color)]', className)}
            {...props}
        />
    )
)

CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardFooter }
