export default function BookingsLoading() {
    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="h-7 w-36 bg-[var(--neutral-200)] rounded-lg" />
                <div className="h-9 w-16 bg-[var(--neutral-200)] rounded-lg" />
            </div>

            {/* Status filter pills */}
            <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-20 bg-[var(--neutral-100)] rounded-full" />
                ))}
            </div>

            {/* Booking card skeletons */}
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="bg-white border border-[var(--border-color)] rounded-xl p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="h-5 w-24 bg-[var(--neutral-200)] rounded" />
                            <div className="h-5 w-16 bg-[var(--neutral-100)] rounded-full" />
                        </div>
                        <div className="h-4 w-48 bg-[var(--neutral-100)] rounded mb-2" />
                        <div className="flex gap-4">
                            <div className="h-3 w-20 bg-[var(--neutral-100)] rounded" />
                            <div className="h-3 w-16 bg-[var(--neutral-100)] rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
