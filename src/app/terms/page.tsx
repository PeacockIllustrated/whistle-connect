import Link from 'next/link'
import Image from 'next/image'

export default function TermsPage() {
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
                    <span className="text-sm font-medium text-white/60">Terms</span>
                </div>
            </header>

            <main className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Terms of Service</h1>
                    <p className="text-[var(--foreground-muted)]">Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="space-y-8 text-[var(--foreground)]">
                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">1. Acceptance of Terms</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            By accessing or using the Whistle Connect application, you agree to be bound by these Terms of Service and by our Privacy Policy. If you do not agree with any part of these terms, you may not access or use the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">2. Eligibility</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            You must be at least 18 years old to hold an account independently. Referees aged 14 to 17 may use the service only with verified consent from a parent or guardian; until that consent is verified, the account is locked.
                        </p>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            You must provide an accurate date of birth when you register. We use it to enforce age-eligibility and safeguarding rules, and providing false age information is a breach of these terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">3. Accounts &amp; Security</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            When you create an account you must provide information that is accurate, complete and current, and keep it up to date. Failure to do so is a breach of these terms and may result in suspension or termination of your account.
                        </p>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            You are responsible for keeping your password and account access secure, and for all activity that takes place under your account. Do not share your password with anyone, and notify us promptly of any unauthorised use.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">4. Acceptable Use &amp; Content Policy</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            The service lets you create profiles, send messages and share information (&quot;Content&quot;). You are responsible for the Content you provide, including its legality and appropriateness.
                        </p>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            <strong>Zero tolerance.</strong> There is no tolerance for objectionable, abusive, harassing, hateful, threatening or sexual content or behaviour, or for any content or conduct that endangers minors or is otherwise harmful or unlawful.
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>You can <strong>report</strong> content or users directly within the app.</li>
                            <li>You can <strong>block</strong> other users in-app.</li>
                            <li>We may remove Content and suspend or terminate accounts that breach this policy, and we will act on valid reports of objectionable content or abusive users within 24 hours.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">5. Safeguarding of Minors</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            The service is used by minors. Referees under the age of 18 require verified parental or guardian consent before their account can be used, and in-app messaging is disabled for them. To meet safeguarding obligations, we share registration and match-related data with The Football Association (the FA). All users must act in a way that protects the welfare of young people; any conduct that endangers a minor will result in immediate action, including removal from the platform and, where appropriate, referral to the relevant authorities.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">6. Bookings, Fees, Wallet &amp; Payments</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            Whistle Connect is a platform that connects coaches and referees. We facilitate bookings but are not a party to the contract for match officiating between a coach and a referee.
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>Payments are processed by Stripe, our third-party payment provider.</li>
                            <li>Coaches can hold wallet credit to fund bookings.</li>
                            <li>When a booking is confirmed, the relevant amount is held in escrow and is released to the referee once the match is completed.</li>
                            <li>Disputes about a booking are handled through the in-app dispute process.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">7. Referee Status &amp; Platform Role</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            This section sets out the nature of the relationship between referees, clubs and coaches, and Whistle Connect.
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>Referees provide match-officiating services as <strong>independent contractors</strong>. They are not employees, workers, agents or representatives of Whistle Connect, and nothing in these terms creates an employment, partnership, joint-venture or agency relationship between a referee and Whistle Connect.</li>
                            <li>Whistle Connect is an <strong>introduction and booking platform</strong>. We connect clubs and coaches with referees and facilitate bookings and payments; we do not provide officiating services ourselves and are not a party to the officiating arrangement between a club or coach and a referee.</li>
                            <li><strong>Responsibility for officiating a match remains with the referee</strong>, including the conduct of the match, decisions made, and compliance with the relevant laws of the game and competition rules.</li>
                            <li><strong>Clubs and coaches are responsible for ensuring the suitability of any official they engage</strong>, including satisfying themselves as to qualifications, FA registration, DBS and safeguarding status, and fitness for the specific fixture and age group, before and at the time of engagement. While we surface verification information where available, we do not guarantee the suitability, qualifications or conduct of any referee.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">8. Cancellations, Refunds &amp; Disputes</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            If a booking is cancelled before completion, any escrow held is handled according to the in-app cancellation and refund process. If you have a problem with a booking, raise it through the in-app dispute flow, where we can review the booking and help resolve the matter.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">9. Referee Payouts</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            Referees receive payouts via Stripe Connect. To receive payments, referees must complete Stripe&apos;s onboarding and provide the information Stripe requires. Payouts are subject to Stripe&apos;s terms and processing times.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">10. Account Deletion &amp; Termination</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            You may delete your account at any time from within the app via Profile &gt; Delete account. We may suspend or terminate your access to the service, with or without notice, if you breach these terms or our policies, or where necessary to protect users or comply with the law. Certain transactional and financial records may be retained after deletion as described in our Privacy Policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">11. Disclaimers &amp; Limitation of Liability</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, whether express or implied, to the fullest extent permitted by law. We are not responsible for the conduct of any user or for the performance of any match officiating arranged through the platform. To the maximum extent permitted by law, we will not be liable for any indirect, incidental or consequential loss arising from your use of the service. Nothing in these terms excludes or limits liability that cannot be excluded or limited under applicable law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">12. Governing Law</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            These terms are governed by the laws of England and Wales, and any disputes are subject to the exclusive jurisdiction of the courts of England and Wales.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">13. Changes</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            We may modify or replace these terms from time to time at our discretion. By continuing to use the service after revised terms take effect, you agree to be bound by them.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">14. Contact</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            If you have questions about these Terms of Service, please contact us at support@whistleconnect.co.uk.
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
                        <Link href="/privacy" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
                            Privacy
                        </Link>
                        <Link href="/terms" className="text-xs font-semibold text-[var(--brand-navy)] hover:text-[var(--brand-primary)]">
                            Terms
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
