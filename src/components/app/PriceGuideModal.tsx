'use client'

import { Modal } from '@/components/ui/Modal'
import { Banknote } from 'lucide-react'

interface PriceGuideRow {
    ageGroup: string
    fee: string
    format: string
}

const PRICE_GUIDE: PriceGuideRow[] = [
    { ageGroup: 'U7–U8', fee: '£15–£20', format: '5v5' },
    { ageGroup: 'U9–U10', fee: '£20–£25', format: '7v7' },
    { ageGroup: 'U11–U12', fee: '£25–£30', format: '9v9' },
    { ageGroup: 'U13–U14', fee: '£30–£35', format: '11v11' },
    { ageGroup: 'U15–U16', fee: '£35–£40', format: '11v11' },
    { ageGroup: 'U17–U18', fee: '£40–£45', format: '11v11' },
    { ageGroup: 'Adult Grassroots', fee: '£45–£60+', format: '11v11' },
]

interface PriceGuideModalProps {
    isOpen: boolean
    onClose: () => void
}

export function PriceGuideModal({ isOpen, onClose }: PriceGuideModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="-mx-4 -mt-4">
                {/* Branded header strip */}
                <div className="px-5 py-4 bg-[var(--brand-navy)] text-white">
                    <div className="flex items-center gap-2.5">
                        <Banknote className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <h2 className="text-base font-bold leading-tight">UK Grassroots Referee Fee Guide</h2>
                            <p className="text-[11px] text-white/70 mt-0.5">
                                Average match fees by age group (2025/26)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="px-4 pt-4">
                    <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[var(--brand-navy)] text-white">
                                    <th className="text-left font-semibold px-3 py-2.5">Age Group</th>
                                    <th className="text-left font-semibold px-3 py-2.5">Typical Fee</th>
                                    <th className="text-left font-semibold px-3 py-2.5">Format</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PRICE_GUIDE.map((row, i) => (
                                    <tr
                                        key={row.ageGroup}
                                        className={
                                            i % 2 === 0
                                                ? 'bg-white'
                                                : 'bg-[var(--neutral-50)]'
                                        }
                                    >
                                        <td className="px-3 py-2.5 font-medium text-[var(--foreground)]">
                                            {row.ageGroup}
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-emerald-700 tabular-nums">
                                            {row.fee}
                                        </td>
                                        <td className="px-3 py-2.5 text-[var(--foreground-muted)] tabular-nums">
                                            {row.format}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-[11px] text-[var(--foreground-muted)] mt-4 leading-relaxed">
                        Figures are based on common grassroots referee fees across UK youth and
                        adult football leagues. Actual fees may vary by county, competition, and
                        travel expenses.
                    </p>

                    {/* Close action */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full mt-4 mb-2 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:opacity-90 transition-opacity"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </Modal>
    )
}
