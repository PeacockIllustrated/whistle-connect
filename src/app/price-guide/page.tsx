import Link from 'next/link'
import Image from 'next/image'
import { REFEREE_FEE_GUIDE, BOOKING_FEE_PENCE } from '@/lib/constants'

export const metadata = {
    title: 'Referee Price Guide | Whistle Connect',
    description: 'Typical UK grassroots football referee match fees by age group.',
}

export default function PriceGuidePage() {
    const bookingFee = (BOOKING_FEE_PENCE / 100).toFixed(2)

    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <Image
                            src="/assets/logo-main-white.svg"
                            alt="Whistle Connect"
                            width={130}
                            height={45}
                            priority
                        />
                    </Link>
                    <span className="text-sm font-medium text-white/60">Price Guide</span>
                </div>
            </header>

            <main className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Referee Price Guide</h1>
                    <p className="text-[var(--foreground-muted)]">
                        Average UK grassroots referee match fees by age group ({new Date().getFullYear()}/{(new Date().getFullYear() + 1) % 100}).
                    </p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[var(--brand-navy)] text-white text-left">
                                <th className="px-4 py-3 font-bold">Age Group</th>
                                <th className="px-4 py-3 font-bold text-center">Typical Match Fee</th>
                                <th className="px-4 py-3 font-bold text-center">Format</th>
                            </tr>
                        </thead>
                        <tbody>
                            {REFEREE_FEE_GUIDE.map((row, i) => (
                                <tr
                                    key={row.label}
                                    className={i % 2 === 0 ? 'bg-[var(--background)]' : 'bg-[var(--background-soft)]'}
                                >
                                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{row.label}</td>
                                    <td className="px-4 py-3 text-center text-[var(--foreground)]">{row.feeLabel}</td>
                                    <td className="px-4 py-3 text-center text-[var(--foreground-muted)]">{row.format}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 space-y-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
                    <p>
                        These figures are a guide to typical fees only — you set your own budget when
                        you create a booking, and referees may price their offer above or below it
                        depending on travel and experience.
                    </p>
                    <p>
                        A £{bookingFee} platform booking fee is added per confirmed booking. It is
                        refunded to you, along with the rest of the purse, if the booking is cancelled.
                    </p>
                </div>

                <div className="mt-8">
                    <Link
                        href="/app/bookings/new"
                        className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-semibold px-5 py-3 text-sm hover:opacity-90 transition-opacity"
                    >
                        Create a booking
                    </Link>
                </div>
            </main>
        </div>
    )
}
