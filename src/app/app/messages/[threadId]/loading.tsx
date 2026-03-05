export default function ChatLoading() {
    return (
        <div className="flex flex-col h-[calc(100dvh-var(--header-height)-var(--bottom-nav-height))] animate-pulse">
            {/* Chat header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-white">
                <div className="w-8 h-8 bg-[var(--neutral-200)] rounded-lg" />
                <div className="w-10 h-10 rounded-full bg-[var(--neutral-200)]" />
                <div>
                    <div className="h-4 w-24 bg-[var(--neutral-200)] rounded mb-1" />
                    <div className="h-3 w-32 bg-[var(--neutral-100)] rounded" />
                </div>
            </div>

            {/* Message bubbles */}
            <div className="flex-1 px-4 py-4 space-y-4">
                {/* Received message */}
                <div className="flex items-end gap-2 max-w-[80%]">
                    <div className="bg-[var(--neutral-100)] rounded-2xl p-3 flex-1">
                        <div className="h-3 w-full bg-[var(--neutral-200)] rounded mb-1.5" />
                        <div className="h-3 w-3/4 bg-[var(--neutral-200)] rounded" />
                    </div>
                </div>
                {/* Sent message */}
                <div className="flex items-end gap-2 max-w-[80%] ml-auto">
                    <div className="bg-[var(--neutral-200)] rounded-2xl p-3 flex-1">
                        <div className="h-3 w-full bg-[var(--neutral-300)] rounded mb-1.5" />
                        <div className="h-3 w-1/2 bg-[var(--neutral-300)] rounded" />
                    </div>
                </div>
                {/* Another received */}
                <div className="flex items-end gap-2 max-w-[60%]">
                    <div className="bg-[var(--neutral-100)] rounded-2xl p-3 flex-1">
                        <div className="h-3 w-full bg-[var(--neutral-200)] rounded" />
                    </div>
                </div>
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-[var(--border-color)] bg-white">
                <div className="h-10 bg-[var(--neutral-100)] rounded-xl" />
            </div>
        </div>
    )
}
