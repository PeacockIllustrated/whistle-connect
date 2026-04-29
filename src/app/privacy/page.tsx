import Link from 'next/link'
import Image from 'next/image'

export default function PrivacyPage() {
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
                    <span className="text-sm font-medium text-white/60">Privacy</span>
                </div>
            </header>

            <main className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Privacy Policy</h1>
                    <p className="text-[var(--foreground-muted)]">Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="space-y-8 text-[var(--foreground)]">
                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">1. Introduction</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            Whistle Connect (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclosure, and safeguard your information when you visit our application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">2. Information We Collect</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            We collect information that you provide directly to us when you register for an account, create a profile, or communicate with us. This may include:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>Name and contact details (email address, phone number)</li>
                            <li>Profile information (role, qualifications, experience)</li>
                            <li>Location data (postcode for finding local matches)</li>
                            <li>Payment information (notes: processed securely via third-payment providers)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">3. How We Use Your Information</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            We use the information we collect to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>Facilitate connections between coaches and referees</li>
                            <li>Process bookings and payments</li>
                            <li>Verify FA registration and qualifications</li>
                            <li>Send you technical notices, updates, and support messages</li>
                            <li>Monitor and analyze trends, usage, and activities in connection with our application</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">4. Sharing Your Information</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)] mt-4">
                            <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others.</li>
                            <li><strong>With Other Users:</strong> When you share personal information or otherwise interact with public areas of the application, such personal information may be viewed by all users.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">5. Contact Us</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            If you have questions or comments about this Privacy Policy, please contact us at support@whistle-connect.com.
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-12 py-8 border-t border-[var(--border-color)] bg-white">
                <div className="max-w-[var(--content-max-width)] mx-auto px-4 text-center">
                    <p className="text-sm text-[var(--foreground-muted)]">
                        &copy; {new Date().getFullYear()} Whistle Connect
                    </p>
                    <div className="flex justify-center gap-4 mt-3">
                        <Link href="/privacy" className="text-xs font-semibold text-[var(--brand-navy)] hover:text-[var(--brand-primary)]">
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
