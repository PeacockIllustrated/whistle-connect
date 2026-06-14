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
    CalendarCheck,
    Wallet,
    Siren,
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
        <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
                <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
            </div>
            {hint && <span className="text-xs text-[var(--foreground-muted)]">{hint}</span>}
        </div>
    )
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-2xl font-bold leading-none tracking-tight text-white sm:text-3xl">{value}</div>
            <div className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-white/60">{label}</div>
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
            {/* ── Hero band ─────────────────────────────────────────── */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-5 shadow-lg">
                <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[var(--wc-red)]/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
                <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Admin overview</p>
                <div className="relative mt-4 grid grid-cols-3 gap-4">
                    <HeroStat label="Total users" value={fmtNum(t.users)} />
                    <HeroStat label="Active bookings" value={fmtNum(t.activeBookings)} />
                    <HeroStat label="Released · 30d" value={fmtPence(overview.money.escrowReleased30dPence)} />
                </div>
            </section>

            {/* ── KPIs ─────────────────────────────────────────────── */}
            <section>
                <SectionHeading title="Key metrics" hint="Trends · last 30 days" />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <KpiCard
                        label="Referees"
                        value={fmtNum(t.referees)}
                        icon={ShieldCheck}
                        tone="brand"
                        deltaLabel={`${fmtNum(t.availableReferees)} available · ${fmtNum(t.verifiedReferees)} FA-verified`}
                    />
                    <KpiCard label="Coaches" value={fmtNum(t.coaches)} icon={Users} tone="sky" deltaLabel={`${fmtNum(t.messages)} messages sent`} />
                    <KpiCard label="Fill rate" value={fmtPct(overview.fillRate)} icon={Target} tone="violet" deltaLabel="bookings that got a referee" />
                    <KpiCard label="Completed" value={fmtNum(t.completedBookings)} icon={CalendarCheck} tone="green" deltaLabel={`${fmtNum(totalBookings)} bookings all-time`} />
                    <KpiCard
                        label="New signups · 7d"
                        value={fmtNum(overview.deltas.signups7d)}
                        icon={TrendingUp}
                        tone="green"
                        delta={overview.deltas.signupsDelta}
                        series={overview.signups30d.map((p) => p.value)}
                    />
                    <KpiCard
                        label="Bookings · 7d"
                        value={fmtNum(overview.deltas.bookings7d)}
                        icon={CalendarDays}
                        tone="brand"
                        delta={overview.deltas.bookingsDelta}
                        series={overview.bookings30d.map((p) => p.value)}
                    />
                    <KpiCard label="Escrow held" value={fmtPence(overview.money.escrowHeldPence)} icon={Wallet} tone="amber" deltaLabel={`${fmtPence(overview.money.escrowReleasedAllPence)} released all-time`} />
                    <KpiCard label="SOS bookings" value={fmtNum(t.sosBookings)} icon={Siren} tone="red" deltaLabel="emergency requests" />
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
