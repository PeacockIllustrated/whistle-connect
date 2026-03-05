export default function ProfileLoading() {
    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto animate-pulse">
            {/* Header */}
            <div className="h-7 w-24 bg-[var(--neutral-200)] rounded-lg mb-6" />

            {/* Avatar + name */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-[var(--neutral-200)]" />
                <div>
                    <div className="h-5 w-32 bg-[var(--neutral-200)] rounded mb-2" />
                    <div className="h-3 w-20 bg-[var(--neutral-100)] rounded" />
                </div>
            </div>

            {/* Form field skeletons */}
            <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 space-y-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i}>
                        <div className="h-3 w-20 bg-[var(--neutral-100)] rounded mb-2" />
                        <div className="h-10 w-full bg-[var(--neutral-100)] rounded-lg" />
                    </div>
                ))}
            </div>

            {/* Save button */}
            <div className="h-12 w-full bg-[var(--neutral-200)] rounded-lg mt-6" />
        </div>
    )
}
