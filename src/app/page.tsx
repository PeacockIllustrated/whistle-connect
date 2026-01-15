import Link from 'next/link'
import { ActionCard } from '@/components/app/ActionCard'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--neutral-900)] via-[var(--neutral-800)] to-[var(--neutral-900)]" />
        <div className="relative max-w-[var(--content-max-width)] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Whistle Connect</h1>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Grassroots Football</p>
            </div>
          </div>
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
          <img
            src="/_brain_caa116f9-3168-4b28-951c-88a6a4ee1a10/grassroots_football_ground_bg_1768475016333.png"
            alt="Grassroots football ground"
            className="w-full h-full object-cover"
          />
          {/* Dark Overlay for Legibility */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--neutral-950)]/90 via-[var(--neutral-900)]/80 to-[var(--brand-primary-dark)]/40" />
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
            <span className="block text-gradient">In Seconds</span>
          </h2>

          <p className="text-white/60 text-lg max-w-xs mx-auto mb-10">
            Connect coaches with qualified, verified officials instantly
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Link href="/auth/register?role=referee" className="w-full">
              <Button size="lg" className="w-full bg-[#cd1719] hover:bg-[#a31214] text-white border-none shadow-lg">
                Register as a Referee
              </Button>
            </Link>
            <Link href="/auth/register?role=coach" className="w-full">
              <Button size="lg" className="w-full bg-[#2a285e] hover:bg-[#1e1c45] text-white border-none shadow-lg">
                Register as a Coach
              </Button>
            </Link>
            <Link href="/auth/login" className="w-full">
              <Button size="lg" className="w-full bg-[#2a285e] hover:bg-[#1e1c45] text-white border-none shadow-lg">
                Central Venue Referees
              </Button>
            </Link>
          </div>
        </div>
      </section>

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
          </div>
        </div>
      </footer>
    </div>
  )
}
