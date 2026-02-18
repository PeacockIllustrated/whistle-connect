'use client'

import { useState } from 'react'
import { ChevronDown, BarChart3 } from 'lucide-react'
import { DashboardStats } from '@/components/app/DashboardStats'
import type { StatItem } from '@/components/app/DashboardStats'

interface StatsAccordionProps {
    title?: string
    stats: StatItem[]
    children?: React.ReactNode
}

export function StatsAccordion({ title = 'Your Stats', stats, children }: StatsAccordionProps) {
    const [open, setOpen] = useState(false)

    return (
        <div className="rounded-2xl overflow-hidden mb-6 border border-[var(--border-color)] shadow-sm">
            {/* Header with subtle gradient */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] transition-all duration-200"
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                        <BarChart3 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-semibold text-sm text-white">{title}</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                    <ChevronDown className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Content */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[500px]' : 'max-h-0'}`}>
                <div className="px-4 py-4 bg-[var(--background-soft)] space-y-4">
                    <DashboardStats stats={stats} />
                    {children}
                </div>
            </div>
        </div>
    )
}
