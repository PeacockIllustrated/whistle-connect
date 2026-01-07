import Link from 'next/link'
import { ActionCard, AccessLane } from '@/components/app/ActionCard'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--neutral-900)] via-[var(--neutral-800)] to-[var(--neutral-900)]" />
        <div className="relative max-w-[var(--content-max-width)] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Whistle Connect</h1>
              <p className="text-xs text-white/50">Grassroots Football</p>
            </div>
          </div>
          <Link
            href="/auth/login"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold text-white transition-all border border-white/10"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--neutral-900)] via-[var(--neutral-800)] to-[var(--brand-primary-dark)]/30" />

        {/* Decorative Elements */}
        <div className="absolute top-20 right-0 w-72 h-72 bg-[var(--brand-primary)]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--brand-accent)]/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative max-w-[var(--content-max-width)] mx-auto px-4 py-16 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-white/80 mb-6">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
            Now Live in Your Area
          </span>

          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Book Referees
            <span className="block text-gradient">In Seconds</span>
          </h2>

          <p className="text-white/60 text-lg max-w-xs mx-auto mb-8">
            Connect coaches with qualified, verified officials instantly
          </p>

          <div className="flex gap-3 justify-center">
            <Link href="/auth/register?role=coach">
              <Button size="lg" glow>
                Get Started
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="ghost" className="text-white border border-white/20">
                I'm a Referee
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main CTAs */}
      <main className="max-w-[var(--content-max-width)] mx-auto px-4 -mt-8 relative z-10">
        <div className="space-y-3">
          <ActionCard
            href="/auth/register?role=coach"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="Book a Referee"
            subtitle="Find and book qualified officials for your match"
            variant="primary"
          />

          <ActionCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            title="Book Security"
            subtitle="Coming soon"
            badge="Soon"
            disabled
          />

          <ActionCard
            href="/auth/login"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="In-App Messenger"
            subtitle="Communicate directly with referees and coaches"
          />
        </div>

        {/* Role Access Lanes */}
        <div className="mt-10 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-widest mb-4">
            Quick Access
          </h3>

          <AccessLane
            href="/auth/register?role=referee"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            title="Referee Access"
            variant="referee"
          />

          <AccessLane
            href="/auth/register?role=coach"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            title="Coach Access"
            variant="coach"
          />
        </div>

        {/* Become a Referee CTA */}
        <div className="mt-10 p-5 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)]/10 via-[var(--brand-primary)]/5 to-transparent border border-[var(--brand-primary)]/20 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/30 animate-float">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--foreground)]">New to the app?</h3>
              <p className="text-sm text-[var(--foreground-muted)]">
                Become a referee and start earning today
              </p>
            </div>
            <Link href="/auth/register?role=referee">
              <Button size="sm" variant="primary">
                Join
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-10 grid grid-cols-2 gap-4">
          {[
            {
              icon: '⚡',
              title: 'Instant Matching',
              desc: 'Auto-match with available refs',
              color: 'from-amber-500/20 to-orange-500/10',
            },
            {
              icon: '✓',
              title: 'Verified Officials',
              desc: 'DBS checked & qualified',
              color: 'from-emerald-500/20 to-teal-500/10',
            },
            {
              icon: '💬',
              title: 'Direct Messaging',
              desc: 'Chat in-app before the match',
              color: 'from-blue-500/20 to-indigo-500/10',
            },
            {
              icon: '📍',
              title: 'Local Coverage',
              desc: 'Referees in your area',
              color: 'from-purple-500/20 to-pink-500/10',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl bg-gradient-to-br ${feature.color} border border-[var(--border-color)] text-center animate-slide-up`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h4 className="font-semibold text-sm">{feature.title}</h4>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-[var(--border-color)]">
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 text-center">
          <p className="text-sm text-[var(--foreground-muted)]">
            &copy; {new Date().getFullYear()} Whistle Connect
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <Link href="#" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Privacy
            </Link>
            <Link href="#" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Terms
            </Link>
            <Link href="/app/components" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Components
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
