export default function MessagesLoading() {
    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto animate-pulse">
            {/* Header */}
            <div className="h-7 w-28 bg-[var(--neutral-200)] rounded-lg mb-6" />

            {/* Thread list skeletons */}
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className="bg-white border border-[var(--border-color)] rounded-xl p-4"
                    >
                        <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-[var(--neutral-200)] flex-shrink-0" />
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="h-4 w-28 bg-[var(--neutral-200)] rounded" />
                                    <div className="h-3 w-12 bg-[var(--neutral-100)] rounded" />
                                </div>
                                <div className="h-3 w-full bg-[var(--neutral-100)] rounded mb-1" />
                                <div className="h-3 w-2/3 bg-[var(--neutral-100)] rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
