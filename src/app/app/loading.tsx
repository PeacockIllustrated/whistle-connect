export default function AppLoading() {
    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto animate-pulse">
            {/* Header skeleton */}
            <div className="h-7 w-40 bg-[var(--neutral-200)] rounded-lg mb-1" />
            <div className="h-4 w-56 bg-[var(--neutral-100)] rounded mb-6" />

            {/* Card skeletons */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="bg-white border border-[var(--border-color)] rounded-xl p-4"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--neutral-200)]" />
                            <div className="flex-1">
                                <div className="h-4 w-32 bg-[var(--neutral-200)] rounded mb-1.5" />
                                <div className="h-3 w-48 bg-[var(--neutral-100)] rounded" />
                            </div>
                        </div>
                        <div className="h-3 w-full bg-[var(--neutral-100)] rounded mb-2" />
                        <div className="h-3 w-2/3 bg-[var(--neutral-100)] rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}
