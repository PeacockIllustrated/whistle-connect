'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent'
    size?: 'sm' | 'md' | 'lg' | 'xl'
    fullWidth?: boolean
    loading?: boolean
    glow?: boolean
    icon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className,
        variant = 'primary',
        size = 'md',
        fullWidth = false,
        loading = false,
        glow = false,
        icon,
        children,
        disabled,
        ...props
    }, ref) => {
        const baseStyles = `
      relative inline-flex items-center justify-center gap-2
      font-semibold transition-all duration-200 ease-out
      touch-target focus-ring disabled:opacity-50 disabled:cursor-not-allowed
      overflow-hidden
    `

        const variants = {
            primary: `
        bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)]
        text-white shadow-md
        hover:shadow-lg hover:-translate-y-0.5
        active:translate-y-0 active:shadow-md
        ${glow ? 'shadow-[var(--shadow-glow)]' : ''}
      `,
            secondary: `
        bg-[var(--neutral-100)] text-[var(--neutral-700)]
        hover:bg-[var(--neutral-200)]
        active:bg-[var(--neutral-300)]
      `,
            outline: `
        border-2 border-[var(--border-color-strong)] bg-transparent
        text-[var(--foreground)]
        hover:bg-[var(--neutral-50)] hover:border-[var(--color-primary)]
        active:bg-[var(--neutral-100)]
      `,
            ghost: `
        bg-transparent text-[var(--foreground)]
        hover:bg-[var(--neutral-100)]
        active:bg-[var(--neutral-200)]
      `,
            danger: `
        bg-gradient-to-br from-red-500 to-red-600
        text-white shadow-md
        hover:shadow-lg hover:-translate-y-0.5
        active:translate-y-0
      `,
            accent: `
        bg-gradient-to-br from-[var(--brand-accent)] to-[#D97706]
        text-white shadow-md
        hover:shadow-lg hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow-accent)]
        active:translate-y-0
      `,
        }

        const sizes = {
            sm: 'h-9 px-4 text-sm rounded-lg',
            md: 'h-11 px-5 text-base rounded-xl',
            lg: 'h-13 px-6 text-lg rounded-xl',
            xl: 'h-14 px-8 text-lg rounded-2xl',
        }

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    fullWidth && 'w-full',
                    className
                )}
                disabled={disabled || loading}
                {...props}
            >
                {/* Shine effect overlay */}
                <span className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />

                {loading ? (
                    <>
                        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="opacity-70">Loading...</span>
                    </>
                ) : (
                    <>
                        {icon && <span className="flex-shrink-0">{icon}</span>}
                        {children}
                    </>
                )}
            </button>
        )
    }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps }
