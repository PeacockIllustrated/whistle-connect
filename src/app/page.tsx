import Link from 'next/link'
import Image from 'next/image'
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
            Connecting Grassroots coaches with Local Referees
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
                alt="The FA — For All"
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
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/privacy" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
