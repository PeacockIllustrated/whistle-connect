import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
            <div className="text-center max-w-md">
                <h1 className="text-6xl font-bold text-[var(--brand-primary)] mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                    Page not found
                </h2>
                <p className="text-[var(--foreground-muted)] mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/app"
                    className="inline-flex items-center px-6 py-3 bg-[var(--brand-primary)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}
