import { Card } from '@/components/ui/Card'
import { ActionCard } from '@/components/app/ActionCard'
import { AdminTriagePanel } from '@/components/app/AdminTriagePanel'
import { AdminBroadcastCard } from '@/components/app/AdminBroadcastCard'
import {
    KpiCard,
    BarSeries,
    StatusBreakdown,
    HealthChip,
    fmtNum,
    fmtPence,
    fmtPct,
} from '@/components/admin/AdminOverviewUI'
import type { AdminOverview, AdminTriage } from '@/app/app/admin/actions'
import {
    Users,
    ShieldCheck,
    UserCheck,
    Target,
    TrendingUp,
    CalendarDays,
    Wallet,
    Banknote,
    FileCheck,
    Flag,
    AlertOctagon,
    Settings,
    ScrollText,
    MapPin,
    type LucideIcon,
} from 'lucide-react'

interface AdminDashboardProps {
    overview: AdminOverview
    triage: AdminTriage | null
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
            {hint && <span className="text-xs text-[var(--foreground-muted)]">{hint}</span>}
        </div>
    )
}

const CONTROLS: { href: string; title: string; subtitle: string; icon: LucideIcon }[] = [
    { href: '/app/admin/referees', title: 'Referees', subtitle: 'Verify FA registration & credentials', icon: ShieldCheck },
    { href: '/app/admin/coaches', title: 'Coaches', subtitle: 'Registered coaches & their bookings', icon: Users },
    { href: '/app/admin/verification', title: 'FA Verification', subtitle: 'County FA confirmation queue', icon: FileCheck },
    { href: '/app/admin/safeguarding', title: 'Safeguarding', subtitle: 'Under-18 parental consent', icon: UserCheck },
    { href: '/app/admin/reports', title: 'Reported Content', subtitle: 'Moderate & block abuse', icon: Flag },
    { href: '/app/disputes', title: 'Disputes', subtitle: 'Resolve complaints & refunds', icon: AlertOctagon },
    { href: '/app/bookings', title: 'All Bookings', subtitle: 'Every booking across the app', icon: CalendarDays },
    { href: '/app/admin/map', title: 'Map', subtitle: 'Referee & booking geography', icon: MapPin },
    { href: '/app/admin/settings', title: 'Platform Settings', subtitle: 'Fees, travel rate & tunables', icon: Settings },
    { href: '/app/admin/audit', title: 'Audit Log', subtitle: 'Record of every admin action', icon: ScrollText },
]

export function AdminDashboard({ overview, triage }: AdminDashboardProps) {
    const t = overview.totals
    const totalBookings = overview.bookingsByStatus.reduce((s, d) => s + d.count, 0)

    return (
        <div className="space-y-6">
            {/* ── KPIs ─────────────────────────────────────────────── */}
            <section>
                <SectionHeading title="Overview" hint="Trends over the last 30 days" />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <KpiCard label="Total users" value={fmtNum(t.users)} icon={Users} deltaLabel={`${fmtNum(t.coaches)} coaches · ${fmtNum(t.referees)} refs`} />
                    <KpiCard
                        label="Referees"
                        value={fmtNum(t.referees)}
                        icon={ShieldCheck}
                        deltaLabel={`${fmtNum(t.availableReferees)} available · ${fmtNum(t.verifiedReferees)} FA-verified`}
                    />
                    <KpiCard label="Fill rate" value={fmtPct(overview.fillRate)} icon={Target} deltaLabel="bookings that got a referee" />
                    <KpiCard label="Active bookings" value={fmtNum(t.activeBookings)} icon={CalendarDays} deltaLabel={`${fmtNum(t.completedBookings)} completed all-time`} />
                    <KpiCard
                        label="New signups · 7d"
                        value={fmtNum(overview.deltas.signups7d)}
                        icon={TrendingUp}
                        delta={overview.deltas.signupsDelta}
                        series={overview.signups30d.map((p) => p.value)}
                        accent="var(--wc-green)"
                    />
                    <KpiCard
                        label="Bookings · 7d"
                        value={fmtNum(overview.deltas.bookings7d)}
                        icon={CalendarDays}
                        delta={overview.deltas.bookingsDelta}
                        series={overview.bookings30d.map((p) => p.value)}
                    />
                    <KpiCard label="Escrow released · 30d" value={fmtPence(overview.money.escrowReleased30dPence)} icon={Banknote} deltaLabel={`${fmtPence(overview.money.escrowReleasedAllPence)} all-time`} />
                    <KpiCard label="Escrow held" value={fmtPence(overview.money.escrowHeldPence)} icon={Wallet} deltaLabel="in flight" />
                </div>
            </section>

            {/* ── Charts ───────────────────────────────────────────── */}
            <section className="grid gap-3 lg:grid-cols-2">
                <Card variant="default" padding="md">
                    <SectionHeading title="Bookings created" hint="Per day · 30d" />
                    <BarSeries data={overview.bookings30d} />
                </Card>
                <Card variant="default" padding="md">
                    <SectionHeading title="New signups" hint="Per day · 30d" />
                    <BarSeries data={overview.signups30d} color="var(--wc-green)" />
                </Card>
            </section>

            {/* ── Status breakdown ─────────────────────────────────── */}
            <Card variant="default" padding="md">
                <SectionHeading title="Bookings by status" hint={`${fmtNum(totalBookings)} total`} />
                <StatusBreakdown data={overview.bookingsByStatus} />
            </Card>

            {/* ── System health ────────────────────────────────────── */}
            <Card variant="default" padding="md">
                <SectionHeading title="System health" hint="Production configuration" />
                <div className="flex flex-wrap gap-2">
                    <HealthChip label="Service role" ok={overview.health.serviceRole} />
                    <HealthChip label="Stripe" ok={overview.health.stripe} />
                    <HealthChip label="Stripe webhooks" ok={overview.health.stripeWebhooks} />
                    <HealthChip label="Web push (VAPID)" ok={overview.health.vapid} />
                    <HealthChip label="Native push (FCM)" ok={overview.health.firebase} />
                    <HealthChip label="Email" ok={overview.health.email} />
                    <HealthChip label="Cron" ok={overview.health.cronSecret} />
                </div>
            </Card>

            {/* ── Operational triage ───────────────────────────────── */}
            {triage && <AdminTriagePanel triage={triage} />}

            {/* ── Broadcast ────────────────────────────────────────── */}
            <AdminBroadcastCard />

            {/* ── Controls ─────────────────────────────────────────── */}
            <section>
                <SectionHeading title="Manage" hint="Control every part of the app" />
                <div className="grid gap-3 sm:grid-cols-2">
                    {CONTROLS.map(({ href, title, subtitle, icon: Icon }) => (
                        <ActionCard
                            key={href}
                            href={href}
                            icon={<Icon className="h-6 w-6" />}
                            title={title}
                            subtitle={subtitle}
                        />
                    ))}
                </div>
            </section>
        </div>
    )
}
