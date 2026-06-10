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
                            Whistle Connect (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal data when you use our application, which connects grassroots football coaches with qualified referees. We are the data controller for the personal data described here and we process it in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. Please read this policy carefully. If you do not agree with it, please do not use the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">2. Information We Collect</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            We collect the following categories of personal data when you register, create or update a profile, make or accept bookings, send messages, or otherwise use the app:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li><strong>Account &amp; contact details</strong> &mdash; your name, email address and any phone number you provide.</li>
                            <li><strong>Role</strong> &mdash; whether you are a coach, referee or administrator, plus referee details such as qualification level, county and DBS status.</li>
                            <li><strong>Date of birth &amp; age</strong> &mdash; collected for referees to enforce age-based eligibility and safeguarding rules (see Children &amp; Safeguarding below).</li>
                            <li><strong>Postcode &amp; approximate location</strong> &mdash; used to match coaches and referees to nearby matches. We geocode your postcode to an approximate location; we do not track your precise real-time location.</li>
                            <li><strong>Payment information</strong> &mdash; processed securely by Stripe, our third-party payment provider. We do not store full card numbers on our servers; we hold transaction records, wallet balances and payout details needed to operate the service.</li>
                            <li><strong>In-app messages</strong> &mdash; the content of messages you send to other users through the app.</li>
                            <li><strong>Device &amp; push tokens</strong> &mdash; web-push subscription details and notification tokens so we can deliver alerts to your device.</li>
                            <li><strong>Error &amp; diagnostic logs</strong> &mdash; technical information including IP address, device and browser details, and error reports captured to keep the service secure and working reliably.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">3. How We Use Your Information</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            We use the personal data we collect to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>Create and manage your account and profile;</li>
                            <li>Facilitate connections and bookings between coaches and referees;</li>
                            <li>Process payments, wallet top-ups, escrow holds and referee payouts;</li>
                            <li>Enable in-app messaging between confirmed parties;</li>
                            <li>Enforce age-eligibility and safeguarding rules, and verify referee qualifications and FA registration;</li>
                            <li>Send you service notifications, booking updates and support messages;</li>
                            <li>Detect, investigate and prevent fraud, abuse and security incidents;</li>
                            <li>Diagnose technical problems and improve the reliability and performance of the app;</li>
                            <li>Comply with our legal and regulatory obligations.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">4. Legal Bases for Processing</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            Under the UK GDPR we rely on the following legal bases:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li><strong>Consent</strong> &mdash; for sending push notifications, and for verified parental or guardian consent where a referee is under 18. You can withdraw consent at any time.</li>
                            <li><strong>Performance of a contract</strong> &mdash; to provide the booking, payment and messaging features you have asked us to provide under our Terms of Service.</li>
                            <li><strong>Legitimate interests</strong> &mdash; to keep the platform secure, prevent fraud and abuse, diagnose errors, and improve the service, balanced against your rights and freedoms.</li>
                            <li><strong>Legal obligation</strong> &mdash; to meet safeguarding duties, retain financial and transactional records, and respond to lawful requests.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">5. Children &amp; Safeguarding</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            Whistle Connect is used by minors. Referees on the platform may be aged 14 to 17. Safeguarding is central to how we operate:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li>We collect date of birth at registration so we can apply age-based eligibility rules and ensure referees are only matched to age-appropriate fixtures.</li>
                            <li>Referees under the age of 18 require verified parental or guardian consent before their account can be used. Until consent is verified, the account is locked.</li>
                            <li>In-app messaging is disabled for referees under 18; coaches are directed to contact a parent or guardian by email for important match updates instead.</li>
                            <li>To meet safeguarding obligations, we share registration and match-related data with The Football Association (the FA). This helps ensure that officials are appropriately registered and that matches involving young people are properly overseen.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">6. Sharing &amp; Third-Party Processors</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            We do not sell your personal data. We share it only where necessary to run the service, meet our legal and safeguarding duties, or with your consent. The third-party processors and partners we use include:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li><strong>Supabase</strong> &mdash; database, authentication and file storage.</li>
                            <li><strong>Stripe</strong> &mdash; payment processing, wallet, escrow and referee payouts.</li>
                            <li><strong>Sentry</strong> &mdash; error monitoring and diagnostics (which may include IP address and diagnostic information).</li>
                            <li><strong>Mapbox</strong> &mdash; geocoding postcodes to approximate locations.</li>
                            <li><strong>Resend</strong> &mdash; sending transactional and verification emails.</li>
                            <li><strong>Vercel</strong> &mdash; application hosting and delivery.</li>
                            <li><strong>web-push / Firebase</strong> &mdash; delivering push notifications to your device.</li>
                            <li><strong>The Football Association (FA)</strong> &mdash; safeguarding, registration and match oversight, as described above.</li>
                        </ul>
                        <p className="text-[var(--neutral-600)] leading-relaxed mt-4">
                            We may also disclose personal data where required by law, to respond to lawful requests, or to protect the rights, property and safety of our users and others.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">7. Data Retention</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            We keep your personal data only for as long as we need it to provide the service and meet our legal obligations. When you delete your account, we erase or anonymise your personal data. However, certain transactional and financial records (for example, payment, payout and escrow records) are retained for the period required by law, accounting standards and audit obligations, even after account deletion.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">8. Your Rights</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            Under UK data protection law, you have the right to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[var(--neutral-600)]">
                            <li><strong>Access</strong> the personal data we hold about you;</li>
                            <li><strong>Rectify</strong> inaccurate or incomplete data;</li>
                            <li><strong>Erase</strong> your data (subject to the retention obligations above);</li>
                            <li><strong>Portability</strong> &mdash; receive your data in a portable format;</li>
                            <li><strong>Object to or restrict</strong> certain processing, and withdraw consent where we rely on it.</li>
                        </ul>
                        <p className="text-[var(--neutral-600)] leading-relaxed mt-4">
                            To exercise any of these rights, contact us at support@whistleconnect.co.uk. You also have the right to lodge a complaint with the UK Information Commissioner&apos;s Office (ICO) at ico.org.uk.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">9. Account Deletion</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            You can delete your account at any time from within the app via Profile &gt; Delete account. When you do, we erase or anonymise your personal data as described in Data Retention above. Please note that transactional and financial records will be retained where we are legally required to keep them.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">10. Cookies &amp; Local Storage</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            We use only essential cookies and local storage needed to keep you signed in and to make the app work, together with diagnostic data used by Sentry for error monitoring. We do not use advertising trackers and we do not sell your data for marketing.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">11. International Transfers</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            Some of our processors may store or process personal data outside the United Kingdom. Where they do, we ensure appropriate safeguards are in place (such as UK adequacy regulations or standard contractual clauses) so that your data continues to receive an equivalent level of protection.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">12. Contact Us</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            If you have questions or comments about this Privacy Policy, or wish to exercise your rights, please contact us at support@whistleconnect.co.uk. If you are not satisfied with our response, you can contact the UK Information Commissioner&apos;s Office (ICO) at ico.org.uk.
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
