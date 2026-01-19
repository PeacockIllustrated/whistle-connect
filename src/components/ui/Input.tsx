import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, id, ...props }, ref) => {
        const generatedId = useId()
        const inputId = id || props.name || generatedId

        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-[var(--foreground)]"
                    >
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        'w-full px-3 py-2.5 min-h-[44px]',
                        'text-base text-[var(--foreground)]',
                        'bg-white border border-[var(--border-color)] rounded-[var(--radius-md)]',
                        'placeholder:text-[var(--foreground-muted)]',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent',
                        'disabled:bg-[var(--neutral-100)] disabled:cursor-not-allowed',
                        'transition-colors duration-200',
                        error && 'border-red-500 focus:ring-red-500',
                        className
                    )}
                    {...props}
                />
                {hint && !error && (
                    <p className="text-sm text-[var(--foreground-muted)]">{hint}</p>
                )}
                {error && (
                    <p className="text-sm text-red-600">{error}</p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

export { Input }
