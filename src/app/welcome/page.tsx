import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
    ArrowRight,
    BellRing,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    FileSearch,
    Radar,
    ShieldCheck,
    Star,
    TrendingUp,
    Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Welcome to Whistle Connect | Grassroots Referee Booking',
    description:
        'Stream referee bookings to every match. Schedule availability automatically. Confirm officials in seconds. All from one dashboard.',
}

type Benefit = {
    title: string
    description: string
    icon?: LucideIcon
}

const challengePains: string[] = [
    'Coaches rely on phone calls, WhatsApp, and word of mouth to find referees',
    'No way to check referee availability or credentials before making contact',
    'Zero visibility of which referees are free for any given match day',
    'Last-minute cancellations leave matches without qualified officials',
    'No standardised booking process across counties',
    'Hours spent coordinating when you should be coaching',
]

const searchPoints: string[] = [
    'Smart matching by county, availability, travel radius, and rating',
    'SOS Emergency mode broadcasts to all nearby available referees',
    'First responder gets auto-assigned — no coordination needed',
    'Referee profiles show reliability scores and match history',
    'Travel radius and FA verification filtering',
    'County-wide coverage across 60+ UK regions',
]

const workflowBenefits: Benefit[] = [
    {
        title: 'Smart Matching',
        description:
            'Automatically surfaces referees who match your match requirements, location, and budget criteria.',
        icon: Radar,
    },
    {
        title: 'Budget Control',
        description:
            'Set match fees upfront. Referees propose pricing, coaches approve before confirmation.',
        icon: Wallet,
    },
    {
        title: 'Auto-Notifications',
        description:
            'Push alerts at every stage — new offer, price submitted, booking confirmed, match day reminders.',
        icon: BellRing,
    },
    {
        title: 'Full Audit Trail',
        description:
            'Complete history of every booking action, offer, and communication for compliance review.',
        icon: ClipboardList,
    },
]

const refereeBenefits: Benefit[] = [
    {
        title: 'Set Availability',
        description: 'Weekly recurring slots and date-specific overrides.',
        icon: Clock,
    },
    {
        title: 'Track Earnings',
        description: 'Season dashboard with monthly breakdown charts.',
        icon: TrendingUp,
    },
    {
        title: 'Build Reputation',
        description: 'Ratings and reliability scores visible to all coaches.',
        icon: Star,
    },
    {
        title: 'Stay Informed',
        description: 'Push notifications for new offers and booking updates.',
        icon: BellRing,
    },
]

const verificationBenefits: Benefit[] = [
    {
        title: 'FA Number Check',
        description:
            'Every referee submits their official FA registration number during sign-up, verified by admin before activation.',
        icon: ShieldCheck,
    },
    {
        title: 'DBS Tracking',
        description:
            'Enhanced DBS clearance status is recorded and monitored, with expiry alerts for administrators.',
        icon: FileSearch,
    },
    {
        title: 'Safeguarding',
        description:
            'Safeguarding course completion is tracked as part of the verification process for youth football officiating.',
        icon: CheckCircle2,
    },
    {
        title: 'Admin Queue',
        description:
            'Dedicated admin verification queue. Pending responses and reviews are streamlined.',
        icon: ClipboardList,
    },
]

const roleTags: string[] = [
    'Role-based access',
    'Real-time updates',
    'Mobile-first design',
    'Push notifications',
]

const searchTags: string[] = ['Smart matching', 'SOS Emergency', 'County filtering']

const ctaStats: { value: string; label: string }[] = [
    { value: '60+', label: 'UK Counties' },
    { value: '14', label: 'Age Groups Configured' },
    { value: '24/7', label: 'Real-Time Booking' },
]

const navLinks: { href: string; label: string }[] = [
    { href: '#challenge', label: 'Challenge' },
    { href: '#roles', label: 'Roles' },
    { href: '#workflow', label: 'Workflow' },
    { href: '#search', label: 'Search' },
    { href: '#referees', label: 'Referees' },
    { href: '#trust', label: 'Trust' },
]

const HERO_GRADIENT =
    'repeating-linear-gradient(30deg, transparent, transparent 24px, rgba(255,255,255,0.018) 24px, rgba(255,255,255,0.018) 25px), radial-gradient(ellipse at 65% 45%, rgba(30,45,66,0.6) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(21,30,46,0.5) 0%, transparent 45%), linear-gradient(155deg, #1e2d42 0%, #1b2537 35%, #151e2e 65%, #0f1720 100%)'

export default function WelcomePage() {
    return (
        <main className="min-h-screen bg-white text-[var(--neutral-900)] antialiased">
            {/* ─────────── HERO ─────────── */}
            <section
                className="relative overflow-hidden text-white"
                style={{ background: HERO_GRADIENT }}
            >
                <header className="relative z-10">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
                        <Link href="/" className="inline-flex items-center">
                            <Image
                                src="/assets/logo-main-white.svg"
                                alt="Whistle Connect"
                                width={156}
                                height={54}
                                priority
                            />
                        </Link>

                        <nav
                            aria-label="Welcome page"
                            className="hidden items-center gap-7 text-sm font-semibold text-white/60 md:flex"
                        >
                            {navLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    className="transition hover:text-white"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>

                        <Link
                            href="/auth/login"
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                        >
                            Sign in
                        </Link>
                    </div>
                </header>

                <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 lg:pb-28 lg:pt-20">
                    <div className="max-w-3xl">
                        <div className="h-px w-24 bg-white/15" />
                        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-white/40">
                            Product Overview
                        </p>

                        <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-[5.5rem]">
                            Book Referees.
                            <br />
                            Match Day Ready.
                        </h1>

                        <ul className="mt-8 space-y-2.5 text-base leading-7 text-white/55 sm:text-lg">
                            <li>Stream referee bookings to every match.</li>
                            <li>Schedule availability automatically.</li>
                            <li>Confirm officials in seconds.</li>
                            <li>All from one dashboard.</li>
                        </ul>

                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/book"
                                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[var(--wc-red)] px-7 text-base font-bold text-white shadow-[0_8mm_35mm_rgba(0,0,0,0.35),0_4mm_15mm_rgba(0,0,0,0.3)] transition hover:bg-[#a31214]"
                            >
                                Book a referee
                                <ArrowRight
                                    className="h-5 w-5 transition group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                />
                            </Link>
                            <Link
                                href="/auth/register?role=referee"
                                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 text-base font-bold text-white backdrop-blur transition hover:bg-white/15"
                            >
                                Join as a referee
                                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </Link>
                        </div>

                        <div className="mt-12 flex items-center gap-4 text-xs font-medium text-white/35">
                            <span>Whistle Connect Ltd.</span>
                            <span className="h-3 w-px bg-white/15" />
                            <span>whistleconnect.co.uk</span>
                        </div>
                    </div>

                    <div className="relative hidden lg:block">
                        <div className="relative -rotate-[5deg]">
                            <PhoneShot
                                src="/assets/screenshots/coach-bookings.png"
                                alt="Coach My Bookings screen on Whistle Connect"
                                priority
                            />
                        </div>
                    </div>
                </div>

                {/* Red accent line, faded right — exact brochure cover signature */}
                <div className="absolute inset-x-0 bottom-0 h-[3px] w-[45%] bg-[linear-gradient(90deg,rgba(205,23,25,0.55),transparent)]" />
            </section>

            {/* ─────────── CHALLENGE ─────────── */}
            <section
                id="challenge"
                className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 lg:py-24"
            >
                <Watermark>02</Watermark>
                <div className="relative mx-auto max-w-7xl">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:gap-12">
                        <div className="rounded-[8px] bg-[var(--wc-blue)] p-8 sm:p-10">
                            <h2 className="text-3xl font-extrabold leading-[1.05] text-white sm:text-4xl">
                                The Challenge
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-white/60">
                                Finding referees should be the easiest part of running a club.
                            </p>

                            <div className="mt-7 space-y-3">
                                <StatCardDark
                                    value="73%"
                                    label="of coaches cite finding referees as their #1 operational challenge"
                                />
                                <StatCardDark
                                    value="5+ hrs"
                                    label="per week wasted on phone calls, texts, and WhatsApp messages"
                                />
                                <StatCardDark
                                    value="30%"
                                    label="of grassroots matches affected by late referee cancellations"
                                />
                            </div>
                        </div>

                        <div>
                            <SectionEyebrow tone="red">The Problem</SectionEyebrow>
                            <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                                Match-day admin shouldn&apos;t be the hard part.
                            </h2>
                            <RedAccentLine className="mt-5" />

                            <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                                Grassroots football in the UK depends on volunteer and
                                semi-professional referees to keep matches running. But for coaches
                                and club secretaries, finding and booking those officials is one of
                                the most frustrating parts of the job.
                            </p>

                            <BulletList items={challengePains} className="mt-6" />

                            <div className="mt-8 rounded-[8px] bg-[var(--wc-blue)] p-6">
                                <h3 className="text-lg font-bold text-white">The Solution</h3>
                                <p className="mt-2 text-sm leading-7 text-white/75">
                                    Whistle Connect replaces the friction between your clubhouse
                                    and your officials. Upload a match, search referees, send
                                    offers — and walk away. Bookings confirm automatically,
                                    messaging is built in, and you can track every match from
                                    anywhere.
                                </p>
                            </div>

                            <Callout className="mt-4">
                                One dashboard. Every match. Every referee. Updated in seconds, not
                                hours.
                            </Callout>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────── ROLES ─────────── */}
            <section
                id="roles"
                className="relative overflow-hidden bg-[var(--neutral-50)] px-5 py-16 sm:px-8 lg:py-24"
            >
                <Watermark>03</Watermark>
                <div className="relative mx-auto max-w-7xl">
                    <div className="max-w-3xl">
                        <SectionEyebrow tone="blue">Platform Roles</SectionEyebrow>
                        <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                            One platform. Two roles. One rhythm.
                        </h2>
                        <RedAccentLine className="mt-5" />
                        <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                            Whistle Connect adapts to each user. Coaches manage bookings and search
                            for officials. Referees handle offers, set availability, and track
                            earnings — all from the same platform, with role-specific UI delivered
                            to every device.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-10">
                        <div className="flex flex-col items-center text-center">
                            <PhoneShot
                                src="/assets/screenshots/coach-dashboard.png"
                                alt="Whistle Connect coach dashboard with quick actions, SOS, wallet and stats"
                            />
                            <p className="mt-6 text-lg font-bold text-[var(--neutral-900)]">
                                Coach
                            </p>
                            <p className="mt-1 text-sm text-[var(--neutral-500)]">
                                Manage bookings, send offers, message referees.
                            </p>
                        </div>

                        <div className="flex flex-col items-center text-center">
                            <PhoneShot
                                src="/assets/screenshots/referee-offers.png"
                                alt="Referee incoming offers inbox showing pending matches"
                            />
                            <p className="mt-6 text-lg font-bold text-[var(--neutral-900)]">
                                Referee
                            </p>
                            <p className="mt-1 text-sm text-[var(--neutral-500)]">
                                Review offers, set availability, track earnings.
                            </p>
                        </div>
                    </div>

                    <div className="mt-12 flex flex-wrap justify-center gap-2">
                        {roleTags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─────────── WORKFLOW ─────────── */}
            <section
                id="workflow"
                className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 lg:py-24"
            >
                <Watermark>04</Watermark>
                <div className="relative mx-auto max-w-7xl">
                    <div className="max-w-3xl">
                        <SectionEyebrow tone="red">Booking Workflow</SectionEyebrow>
                        <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                            Book. Offer. Confirm.
                        </h2>
                        <RedAccentLine className="mt-5" />
                        <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                            Create a booking with match details, search for available referees by
                            location and rating, then send offers directly. Referees accept with
                            pricing, and your match is confirmed — all within the app.
                        </p>
                    </div>

                    <div className="mt-10 space-y-6">
                        <WorkflowRow
                            label="Booking workflow"
                            pills={[
                                { label: 'Draft', tone: 'gray' },
                                { label: 'Pending', tone: 'amber' },
                                { label: 'Offered', tone: 'purple' },
                                { label: 'Confirmed', tone: 'green' },
                                { label: 'Completed', tone: 'cyan' },
                            ]}
                            branchPill={{ label: 'Cancelled', tone: 'red' }}
                        />

                        <WorkflowRow
                            label="Offer workflow"
                            pills={[
                                { label: 'Sent', tone: 'gray' },
                                { label: 'Accepted & Priced', tone: 'amber' },
                                { label: 'Accepted', tone: 'green' },
                            ]}
                            branchPill={{ label: 'Declined', tone: 'red' }}
                        />
                    </div>

                    <Callout className="mt-8 max-w-3xl">
                        Supports individual match bookings and central venue / tournament bookings.
                        Budget, age group, format, and required referee level are all captured at
                        creation.
                    </Callout>

                    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {workflowBenefits.map((item) => (
                            <BenefitCard key={item.title} item={item} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─────────── SEARCH / SOS ─────────── */}
            <section
                id="search"
                className="relative overflow-hidden bg-[var(--neutral-50)] px-5 py-16 sm:px-8 lg:py-24"
            >
                <Watermark>05</Watermark>
                <div className="relative mx-auto max-w-7xl">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14">
                        <div>
                            <SectionEyebrow tone="red">Smart Search</SectionEyebrow>
                            <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                                Find referees fast,
                                <br />
                                even last minute.
                            </h2>
                            <RedAccentLine className="mt-5" />
                            <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                                The smart search algorithm matches your fixture with the best
                                available referees based on county, distance, availability, and
                                rating. For emergencies, SOS mode broadcasts your match to every
                                nearby official instantly.
                            </p>

                            <BulletList items={searchPoints} className="mt-7" />

                            <Callout className="mt-7">
                                Your SOS goes live at 9am. By 9:02, three local referees have seen
                                it. By 9:05, one has accepted and your match is covered. You set it
                                once. Whistle Connect does the rest.
                            </Callout>

                            <div className="mt-7 flex flex-wrap gap-2">
                                {searchTags.map((tag) => (
                                    <Tag key={tag}>{tag}</Tag>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-center lg:justify-end">
                            <PhoneShot
                                src="/assets/screenshots/coach-search.png"
                                alt="New booking flow capturing match details for referee search"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────── REFEREE EXPERIENCE ─────────── */}
            <section
                id="referees"
                className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 lg:py-24"
            >
                <Watermark>06</Watermark>
                <div className="relative mx-auto max-w-7xl">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14">
                        <div>
                            <SectionEyebrow tone="red">For Referees</SectionEyebrow>
                            <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                                Empowering every referee.
                            </h2>
                            <RedAccentLine className="mt-5" />
                            <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                                Referees get their own tailored experience. Set weekly availability,
                                respond to offers, track season earnings, and build a reputation
                                that coaches can trust. Every completed match adds to a public
                                reliability score.
                            </p>

                            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                {refereeBenefits.map((item) => (
                                    <BenefitCard key={item.title} item={item} />
                                ))}
                            </div>

                            <Link
                                href="/auth/register?role=referee"
                                className="group mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--wc-red)] px-6 text-sm font-bold text-white transition hover:bg-[#a31214]"
                            >
                                Register as a referee
                                <ArrowRight
                                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                />
                            </Link>
                        </div>

                        <div className="order-first flex justify-center lg:order-none lg:justify-end">
                            <PhoneShot
                                src="/assets/screenshots/referee-earnings.png"
                                alt="Referee season earnings dashboard with monthly breakdown"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────── FA VERIFIED ─────────── */}
            <section
                id="trust"
                className="relative overflow-hidden bg-[var(--neutral-50)] px-5 py-16 sm:px-8 lg:py-24"
            >
                <Watermark>07</Watermark>
                <div className="relative mx-auto max-w-7xl text-center">
                    <div className="mx-auto max-w-3xl">
                        <SectionEyebrow tone="blue" align="center">
                            Verification
                        </SectionEyebrow>
                        <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                            FA Verified. Always Compliant.
                        </h2>
                        <div className="mx-auto mt-5 h-[2px] w-32 bg-[linear-gradient(90deg,transparent,var(--wc-red),transparent)]" />
                        <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                            Every referee on Whistle Connect is verified through the County FA. Our
                            admin verification queue ensures that FA numbers, DBS certificates, and
                            safeguarding qualifications are checked and monitored — giving coaches
                            confidence that every official is qualified.
                        </p>
                    </div>

                    <div className="mt-12 flex justify-center">
                        <FaVerifiedBadge />
                    </div>

                    <p className="mt-7 text-sm italic text-[var(--neutral-500)]">
                        Verification stages — submit to admin queue, verified profile and
                        match-ready status.
                    </p>

                    <div className="mt-10 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                        {verificationBenefits.map((item) => (
                            <BenefitCard key={item.title} item={item} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─────────── FINAL CTA ─────────── */}
            <section className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 lg:py-24">
                <Watermark>08</Watermark>
                <div className="relative mx-auto max-w-7xl">
                    <div className="mx-auto max-w-3xl text-center">
                        <SectionEyebrow tone="red" align="center">
                            Get Started
                        </SectionEyebrow>
                        <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-[var(--neutral-900)] sm:text-4xl">
                            Ready for the next fixture?
                        </h2>
                        <div className="mx-auto mt-5 h-[2px] w-32 bg-[linear-gradient(90deg,transparent,var(--wc-red),transparent)]" />
                        <p className="mt-6 text-base leading-7 text-[var(--neutral-600)] sm:text-[17px] sm:leading-8">
                            Start with a coach booking or create a referee profile and keep the
                            weekend schedule moving.
                        </p>
                    </div>

                    <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
                        {ctaStats.map((stat) => (
                            <CtaStat key={stat.label} value={stat.value} label={stat.label} />
                        ))}
                    </div>

                    <div className="relative mx-auto mt-12 max-w-4xl overflow-hidden rounded-[12px] bg-[var(--wc-blue)] p-8 sm:p-12">
                        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--wc-red)] opacity-10 blur-3xl" />
                        <div className="relative">
                            <div className="text-center">
                                <h3 className="text-2xl font-extrabold text-white sm:text-3xl">
                                    Ready to see it in action?
                                </h3>
                                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/70">
                                    Whistle Connect ships every grassroots match-day workflow in
                                    one place. Sign up free and book your first referee in minutes,
                                    or get in touch.
                                </p>
                            </div>

                            <div className="mt-8 grid gap-3 text-center sm:grid-cols-2">
                                <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                                        Email
                                    </p>
                                    <p className="mt-2 text-base font-semibold text-white">
                                        hello@whistleconnect.co.uk
                                    </p>
                                </div>
                                <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                                        Web
                                    </p>
                                    <p className="mt-2 text-base font-semibold text-white">
                                        whistleconnect.co.uk
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                                <Link
                                    href="/book"
                                    className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--wc-red)] px-6 text-sm font-bold text-white transition hover:bg-[#a31214]"
                                >
                                    Book a referee
                                    <ArrowRight
                                        className="h-4 w-4 transition group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    />
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/15"
                                >
                                    Create account
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </div>

                            <div className="mt-8 flex justify-center opacity-30">
                                <Image
                                    src="/assets/logo-main-white.svg"
                                    alt=""
                                    width={140}
                                    height={48}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────── FOOTER ─────────── */}
            <footer className="border-t border-[var(--border-color)] bg-[var(--neutral-50)] px-5 py-10 sm:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Image
                            src="/assets/wordmark-blue.svg"
                            alt="Whistle Connect"
                            width={190}
                            height={32}
                        />
                        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--neutral-600)]">
                            Grassroots referee booking for coaches, clubs and officials.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <Image
                            src="/assets/FA For All.png"
                            alt="The FA For All"
                            width={90}
                            height={52}
                            className="h-12 w-auto object-contain"
                            unoptimized
                        />
                        <Image
                            src="/assets/NFA Logo.png"
                            alt="Northumberland Football Association"
                            width={52}
                            height={52}
                            className="h-12 w-auto object-contain"
                            unoptimized
                        />
                        <div className="flex gap-4 text-sm font-semibold text-[var(--neutral-600)]">
                            <Link href="/privacy" className="hover:text-[var(--neutral-900)]">
                                Privacy
                            </Link>
                            <Link href="/terms" className="hover:text-[var(--neutral-900)]">
                                Terms
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    )
}

/* ────────────────────────────── HELPERS ────────────────────────────── */

function SectionEyebrow({
    children,
    tone = 'red',
    align = 'left',
}: {
    children: React.ReactNode
    tone?: 'red' | 'blue' | 'light'
    align?: 'left' | 'center'
}) {
    const colorClass =
        tone === 'red'
            ? 'text-[var(--wc-red)]'
            : tone === 'blue'
                ? 'text-[var(--wc-blue)]'
                : 'text-white/60'
    return (
        <p
            className={`text-xs font-bold uppercase tracking-[0.22em] ${colorClass} ${align === 'center' ? 'text-center' : ''}`}
        >
            {children}
        </p>
    )
}

function RedAccentLine({ className = '' }: { className?: string }) {
    return (
        <div
            className={`h-[2px] w-32 bg-[linear-gradient(90deg,var(--wc-red),rgba(205,23,25,0))] ${className}`}
        />
    )
}

function Watermark({ children }: { children: React.ReactNode }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute right-6 top-10 select-none text-[8rem] font-black leading-none text-[var(--wc-red)] opacity-[0.05] sm:right-10 sm:text-[10rem]"
        >
            {children}
        </span>
    )
}

function BulletList({ items, className = '' }: { items: string[]; className?: string }) {
    return (
        <ul className={`space-y-2.5 ${className}`}>
            {items.map((item) => (
                <li
                    key={item}
                    className="relative pl-6 text-sm leading-6 text-[var(--neutral-600)] sm:text-[15px] sm:leading-7"
                >
                    <span
                        aria-hidden="true"
                        className="absolute left-0 top-[0.55rem] h-2 w-2 rounded-full bg-[var(--wc-red)]"
                    />
                    {item}
                </li>
            ))}
        </ul>
    )
}

function BenefitCard({ item }: { item: Benefit }) {
    return (
        <div className="rounded-[8px] border border-[var(--border-color)] bg-[var(--neutral-50)] p-5">
            {item.icon ? (
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-[6px] bg-white text-[var(--wc-blue)] shadow-sm ring-1 ring-[var(--border-color)]">
                    <item.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </div>
            ) : null}
            <h3 className="text-[15px] font-bold text-[var(--neutral-900)]">{item.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-[var(--neutral-600)]">
                {item.description}
            </p>
        </div>
    )
}

function Callout({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={`rounded-r-[8px] border-l-[3px] border-[var(--wc-red)] bg-[var(--neutral-50)] px-5 py-4 text-sm italic leading-7 text-[var(--neutral-600)] sm:text-[15px] ${className}`}
        >
            {children}
        </div>
    )
}

function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-[4px] border border-[var(--border-color)] bg-[var(--neutral-50)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-600)]">
            {children}
        </span>
    )
}

function StatCardDark({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-[6px] bg-white/[0.06] px-5 py-4">
            <div className="text-2xl font-extrabold text-white sm:text-[1.75rem]">{value}</div>
            <div className="mt-1 text-xs leading-5 text-white/55 sm:text-[13px]">{label}</div>
        </div>
    )
}

function CtaStat({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-[8px] border border-[var(--border-color)] bg-[var(--neutral-50)] px-6 py-5 text-center">
            <div className="text-3xl font-extrabold text-[var(--wc-red)] sm:text-4xl">{value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--neutral-500)]">
                {label}
            </div>
        </div>
    )
}

type PillTone = 'gray' | 'amber' | 'purple' | 'green' | 'cyan' | 'red'

const PILL_BG: Record<PillTone, string> = {
    gray: 'bg-[#64748B]',
    amber: 'bg-[#F59E0B]',
    purple: 'bg-[#7C3AED]',
    green: 'bg-[#10B981]',
    cyan: 'bg-[#06B6D4]',
    red: 'bg-[#EF4444]',
}

function WorkflowRow({
    label,
    pills,
    branchPill,
}: {
    label: string
    pills: { label: string; tone: PillTone }[]
    branchPill?: { label: string; tone: PillTone }
}) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--neutral-500)]">
                {label}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {pills.map((pill, idx) => (
                    <div key={pill.label} className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold text-white ${PILL_BG[pill.tone]}`}
                        >
                            {pill.label}
                        </span>
                        {idx < pills.length - 1 ? (
                            <span
                                aria-hidden="true"
                                className="text-[var(--neutral-400)]"
                            >
                                →
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>
            {branchPill ? (
                <div className="mt-2 flex items-center gap-2 pl-6">
                    <span
                        aria-hidden="true"
                        className="text-base text-[var(--neutral-400)]"
                    >
                        ↳
                    </span>
                    <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold text-white ${PILL_BG[branchPill.tone]}`}
                    >
                        {branchPill.label}
                    </span>
                </div>
            ) : null}
        </div>
    )
}

function FaVerifiedBadge() {
    return (
        <div className="inline-flex items-center gap-6 rounded-[16px] bg-[#10B981] px-10 py-6 shadow-[0_15mm_45mm_rgba(16,185,129,0.25)] sm:gap-8 sm:px-14 sm:py-8">
            <svg
                width="84"
                height="84"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="flex-shrink-0"
            >
                <path
                    d="M50 5 L85 20 L85 50 C85 72 68 90 50 95 C32 90 15 72 15 50 L15 20 Z"
                    fill="rgba(255,255,255,0.2)"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M35 50 L45 60 L65 40"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
            <div className="text-left">
                <div className="text-2xl font-black tracking-[0.05em] text-white sm:text-3xl">
                    FA VERIFIED
                </div>
                <div className="mt-1 text-xs font-medium text-white/80 sm:text-sm">
                    Qualified · Cleared · Compliant
                </div>
            </div>
        </div>
    )
}


/* ───────── Phone shot — frames a real app screenshot ───────── */

function PhoneShot({
    src,
    alt,
    priority = false,
    size = 'md',
}: {
    src: string
    alt: string
    priority?: boolean
    size?: 'sm' | 'md' | 'lg'
}) {
    const widthClass =
        size === 'lg'
            ? 'w-[260px] sm:w-[280px]'
            : size === 'sm'
                ? 'w-[210px] sm:w-[230px]'
                : 'w-[240px] sm:w-[260px]'

    return (
        <div className="inline-block">
            <div className="rounded-[36px] bg-[#1a1a1a] p-[6px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45),0_12px_30px_-10px_rgba(0,0,0,0.3)] ring-1 ring-black/40">
                <div
                    className={`relative aspect-[390/844] overflow-hidden rounded-[30px] bg-[#f9fafb] ${widthClass}`}
                >
                    <Image
                        src={src}
                        alt={alt}
                        fill
                        priority={priority}
                        sizes="(min-width: 640px) 280px, 240px"
                        className="object-cover object-top"
                    />
                    {/* Speaker / camera island — sits over the app's own header bar */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-2 h-[18px] w-[88px] -translate-x-1/2 rounded-full bg-black/85"
                    />
                </div>
            </div>
        </div>
    )
}
