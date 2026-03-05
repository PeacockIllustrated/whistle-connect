export default function BookingDetailLoading() {
    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto animate-pulse">
            {/* Back button + title */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-[var(--neutral-200)] rounded-lg" />
                <div className="h-6 w-40 bg-[var(--neutral-200)] rounded-lg" />
            </div>

            {/* Status badge */}
            <div className="h-7 w-24 bg-[var(--neutral-100)] rounded-full mb-4" />

            {/* Map skeleton */}
            <div className="h-[200px] bg-[var(--neutral-200)] rounded-xl mb-6" />

            {/* Info grid */}
            <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i}>
                            <div className="h-3 w-16 bg-[var(--neutral-100)] rounded mb-1.5" />
                            <div className="h-4 w-28 bg-[var(--neutral-200)] rounded" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
                <div className="h-10 flex-1 bg-[var(--neutral-200)] rounded-lg" />
                <div className="h-10 flex-1 bg-[var(--neutral-100)] rounded-lg" />
            </div>
        </div>
    )
}
