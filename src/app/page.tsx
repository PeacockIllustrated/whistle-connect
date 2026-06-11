import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, Clock, Bell, Users, CalendarX, Wallet, MapPin, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import SplashScreen from '@/components/ui/SplashScreen'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()

  const [{ count: coachCount }, { count: refereeCount }, { count: totalCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'referee'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const coachPains = [
    { Icon: Users, value: '73%', label: 'of coaches say finding referees is their #1 headache' },
    { Icon: Clock, value: '5+ hrs', label: 'a week lost to calls, texts and WhatsApp chasing officials' },
    { Icon: CalendarX, value: '30%', label: 'of grassroots matches hit by late referee cancellations' },
  ]

  const refereePoints = [
    { Icon: Wallet, title: 'Paid for every game', body: 'Match fees are held when a coach books and paid into your wallet after kick-off. No chasing cash, no awkward touchline maths.' },
    { Icon: MapPin, title: 'Games that fit your life', body: 'Set your availability once and get offers for matches near you, with distance, kick-off and fee shown up front.' },
    { Icon: CalendarCheck, title: 'No wasted journeys', body: 'Every booking is confirmed in the app before you travel, so you only turn up to games that are actually on.' },
  ]

  // Question-led FAQ, mirrored into FAQPage JSON-LD below for answer-engine
  // optimisation (AEO) - concise, direct answers to the questions coaches and
  // referees actually ask.
  const faqs = [
    {
      q: 'How do I book a referee on Whistle Connect?',
      a: 'Post your match details, see FA-verified referees near you with ratings and distance, then send an offer, and most matches are confirmed in the app within minutes.',
    },
    {
      q: 'Are the referees FA-verified?',
      a: 'Yes. Every referee is FA-verified, with DBS and safeguarding checks tracked, so you can book with complete confidence.',
    },
    {
      q: 'How does payment work?',
      a: 'Your payment is held securely when you confirm a booking and only released to the referee after the match is played. No cash on the touchline, no chasing invoices.',
    },
    {
      q: 'What if my referee cancels last-minute?',
      a: 'Switch on SOS mode to instantly alert every available official near your venue. Most last-minute gaps are covered in minutes, not hours.',
    },
    {
      q: 'Is it free to join, and how do referees get paid?',
      a: 'Creating an account is free. Coaches pay the referee’s match fee plus a small booking fee at confirmation; referees set their availability, accept nearby offers, and get paid securely after every game.',
    },
  ]

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SplashScreen always />
      {/* Header */}
      <header className="relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--neutral-900)] via-[var(--neutral-800)] to-[var(--neutral-900)]" />
        <div className="relative max-w-[var(--content-max-width)] mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/logo-main-white.svg"
              alt="Whistle Connect"
              width={160}
              height={55}
              priority
            />
          </Link>
          <Link
            href="/auth/login"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold text-white transition-all border border-white/10"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[500px] flex items-center">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <Image
            src="/assets/coach-shake.jpeg"
            alt="Coach and referee shaking hands on the pitch"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          {/* Dark Overlay for Legibility */}
          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-0 w-72 h-72 bg-[var(--brand-primary)]/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--brand-accent)]/5 rounded-full blur-3xl opacity-50" />

        {/* Content */}
        <div className="relative max-w-[var(--content-max-width)] mx-auto px-4 py-16 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-white/80 mb-6">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
            Empowering the Game
          </span>

          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Book Referees
            <span className="block text-white">In Seconds</span>
          </h2>

          <p className="text-white/60 text-lg max-w-xs mx-auto mb-10">
            Connecting Grassroots Coaches with Local Referees
          </p>

          <div className="flex flex-col gap-4 max-w-xs mx-auto">
            <Link
              href="/book"
              className="block w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold rounded-xl text-center transition-all shadow-md"
            >
              Book a Referee
            </Link>

            <div className="grid grid-cols-1 gap-3 mt-4">
              <Link href="/auth/register?role=coach" className="w-full">
                <Button variant="ghost" className="w-full bg-white hover:bg-white/90 text-[var(--neutral-800)] font-bold border border-white/20 flex items-center justify-center gap-2">
                  Register as a Coach
                </Button>
              </Link>
              <Link href="/auth/register?role=referee" className="w-full">
                <Button variant="ghost" className="w-full bg-white hover:bg-white/90 text-[var(--wc-red)] font-bold border border-white/20 flex items-center justify-center gap-2">
                  Register as a Referee
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Whistle Connect - feature highlights */}
      <section className="py-10 bg-[var(--surface)]">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4">
          <div className="rounded-3xl bg-white border border-[var(--border-color)] shadow-sm px-4 py-8 sm:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8">
              {[
                { Icon: ShieldCheck, title: 'FA Verified', body: 'All referees are verified and trusted' },
                { Icon: Clock, title: 'Quick & Easy', body: 'Book in seconds and save time' },
                { Icon: Bell, title: 'Stay Informed', body: 'Real-time updates and notifications' },
                { Icon: Users, title: 'Built for Grassroots', body: 'Connecting coaches and referees' },
              ].map(({ Icon, title, body }) => (
                <div
                  key={title}
                  className="flex flex-col items-center text-center px-3 lg:border-l lg:border-[var(--border-color)] lg:first:border-l-0"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#fdecec] flex items-center justify-center mb-3">
                    <Icon className="w-7 h-7 text-[var(--wc-red)]" strokeWidth={2} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--wc-blue)]">{title}</h3>
                  <p className="text-xs sm:text-sm text-[var(--foreground-muted)] mt-1 max-w-[18ch]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* For coaches - the pain we solve (navy-accented, on brand) */}
      <section className="py-12 bg-[var(--surface)]">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wc-blue)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wc-blue)]">
              <Users className="h-3.5 w-3.5" /> For coaches
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-[var(--wc-blue)] leading-tight">
              Finding a referee shouldn&apos;t be the hard part
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--foreground-muted)] max-w-md mx-auto">
              Grassroots coaches lose hours every week chasing officials. Whistle Connect replaces the calls, texts and no-shows with one simple app.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {coachPains.map((p) => (
              <div
                key={p.value}
                className="relative overflow-hidden rounded-2xl bg-white border border-[var(--border-color)] shadow-sm px-5 py-6 text-left"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-[var(--wc-blue)]" />
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--wc-blue)]/10 text-[var(--wc-blue)]">
                    <p.Icon className="h-5 w-5" />
                  </span>
                  <div className="text-3xl font-extrabold text-[var(--wc-blue)]">{p.value}</div>
                </div>
                <p className="mt-3 text-xs sm:text-sm text-[var(--foreground-muted)] leading-snug">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For referees - their pain we solve (red-accented, tinted panel) */}
      <section className="py-12 bg-[#fdf2f2] border-y border-[var(--border-color)]">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wc-red)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wc-red)]">
              <Wallet className="h-3.5 w-3.5" /> For referees
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-[var(--wc-blue)] leading-tight">
              More games. Less hassle. Paid every time.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--foreground-muted)] max-w-md mx-auto">
              Chasing match fees and filling quiet weekends is the worst part of the job. Whistle Connect sorts both, so you can just referee.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {refereePoints.map((p) => (
              <div
                key={p.title}
                className="relative overflow-hidden rounded-2xl bg-white border border-[var(--border-color)] shadow-sm px-5 py-6 text-left"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-[var(--wc-red)]" />
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fdecec] text-[var(--wc-red)]">
                  <p.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm sm:text-base font-bold text-[var(--wc-blue)]">{p.title}</h3>
                <p className="mt-1.5 text-xs sm:text-sm text-[var(--foreground-muted)] leading-snug">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/auth/register?role=referee"
              className="inline-block px-8 py-3.5 bg-[var(--wc-red)] hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Register as a Referee
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ - question-led content + FAQPage schema for answer-engine optimisation */}
      <section className="py-12 bg-[var(--background)]" aria-labelledby="faq-heading">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4">
          <h2
            id="faq-heading"
            className="text-2xl sm:text-3xl font-extrabold text-[var(--wc-blue)] text-center mb-6"
          >
            Common questions
          </h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl bg-white border border-[var(--border-color)] shadow-sm px-5 py-5"
              >
                <h3 className="text-sm sm:text-base font-bold text-[var(--wc-blue)]">{f.q}</h3>
                <p className="mt-2 text-sm text-[var(--foreground-muted)] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/book"
              className="inline-block px-8 py-3.5 bg-[var(--wc-red)] hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Book a Referee
            </Link>
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      </section>

      {/* Stats */}
      <section className="py-5 bg-[var(--surface)]">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4">
          <div className="flex items-center justify-center divide-x divide-[var(--border-color)]">
            <div className="px-6 text-center">
              <p className="text-2xl font-bold text-[var(--foreground)]">{coachCount ?? 0}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5">Coaches</p>
            </div>
            <div className="px-6 text-center">
              <p className="text-2xl font-bold text-[var(--foreground)]">{refereeCount ?? 0}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5">Referees</p>
            </div>
            <div className="px-6 text-center">
              <p className="text-2xl font-bold text-[var(--foreground)]">{totalCount ?? 0}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5">Users</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-[var(--border-color)]">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">
            Affiliated with
          </p>
          <div className="flex items-start justify-center gap-10 mb-4">
            <div className="flex flex-col items-center gap-1.5">
              <Image
                src="/assets/FA For All.png"
                alt="The FA - For All"
                width={96}
                height={56}
                className="object-contain h-14"
                unoptimized
              />
              <p className="text-[9px] text-[var(--foreground-subtle)]">The Football Association</p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Image
                src="/assets/NFA Logo.png"
                alt="Northumberland Football Association"
                width={56}
                height={56}
                className="object-contain"
                unoptimized
              />
              <p className="text-[9px] text-[var(--foreground-subtle)]">Northumberland FA</p>
            </div>
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">
            &copy; {new Date().getFullYear()} Whistle Connect
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            <Link href="/privacy" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Terms
            </Link>
            <a href="mailto:support@whistleconnect.co.uk" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              support@whistleconnect.co.uk
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
