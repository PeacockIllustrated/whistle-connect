import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
    /** Current page number (1-based) */
    currentPage: number
    /** Total number of items */
    totalItems: number
    /** Items per page */
    pageSize: number
    /** Base URL path (e.g. "/app/bookings") */
    basePath: string
    /** Additional query params to preserve (e.g. { status: 'confirmed' }) */
    params?: Record<string, string>
}

export function Pagination({
    currentPage,
    totalItems,
    pageSize,
    basePath,
    params = {},
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / pageSize)

    // Don't render if there's only one page or less
    if (totalPages <= 1) return null

    function buildUrl(page: number): string {
        const searchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
            if (value) searchParams.set(key, value)
        }
        if (page > 1) searchParams.set('page', String(page))
        const qs = searchParams.toString()
        return qs ? `${basePath}?${qs}` : basePath
    }

    const hasPrev = currentPage > 1
    const hasNext = currentPage < totalPages

    return (
        <div className="flex items-center justify-between pt-4">
            {hasPrev ? (
                <Link
                    href={buildUrl(currentPage - 1)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] bg-[var(--neutral-100)] hover:bg-[var(--neutral-200)] rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </Link>
            ) : (
                <span />
            )}

            <span className="text-sm text-[var(--foreground-muted)]">
                Page {currentPage} of {totalPages}
            </span>

            {hasNext ? (
                <Link
                    href={buildUrl(currentPage + 1)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] bg-[var(--neutral-100)] hover:bg-[var(--neutral-200)] rounded-lg transition-colors"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </Link>
            ) : (
                <span />
            )}
        </div>
    )
}
