import { cn } from '@/lib/utils'

export interface EmptyStateProps {
    icon?: React.ReactNode
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
            {icon && (
                <div className="mb-4 text-[var(--neutral-400)]">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-[var(--foreground-muted)] max-w-sm mb-4">
                    {description}
                </p>
            )}
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    )
}
