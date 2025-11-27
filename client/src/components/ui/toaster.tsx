import { useToast } from "@/hooks/use-toast"

export function Toaster() {
    const { toasts } = useToast()

    return (
        <div className="fixed top-0 right-0 z-[100] flex flex-col gap-2 p-4 max-w-[420px] w-full">
            {toasts.map(function ({ id, title, description, action, ...props }) {
                return (
                    <div
                        key={id}
                        className="group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border bg-popover p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full"
                        {...props}
                    >
                        <div className="grid gap-1">
                            {title && <div className="text-sm font-semibold">{title}</div>}
                            {description && (
                                <div className="text-sm opacity-90">{description}</div>
                            )}
                        </div>
                        {action}
                    </div>
                )
            })}
        </div>
    )
}
