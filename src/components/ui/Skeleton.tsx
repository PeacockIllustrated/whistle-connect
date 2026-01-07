import { cn } from '@/lib/utils'

export interface SkeletonProps {
    className?: string
    variant?: 'text' | 'circular' | 'rectangular'
    width?: string | number
    height?: string | number
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse bg-[var(--neutral-200)]',
                {
                    'h-4 rounded': variant === 'text',
                    'rounded-full': variant === 'circular',
                    'rounded-[var(--radius-md)]': variant === 'rectangular',
                },
                className
            )}
            style={{ width, height }}
        />
    )
}

export function SkeletonCard() {
    return (
        <div className="card p-4 space-y-3">
            <div className="flex justify-between items-start">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
        </div>
    )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    )
}
