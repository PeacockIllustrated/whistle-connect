# Whistle Connect premortem transcript

Generated 4 June 2026. Hybrid lens (software + commercial / regulatory). Full fan-out, 11 investigators.

The premise is fictional. Nothing here has happened. It is written as though it had, so the failure modes are specific enough to prevent. Cards 8 and 10 were confirmed against the live codebase during the run; the rest are reasoned from documented project state in CLAUDE.md and the app-store-readiness memory.

---

## 1. Gathered context

**What it is.** Whistle Connect, a grassroots football operations app (Next.js 16 / React 19 / Supabase / Stripe) connecting coaches who need referees with available qualified referees. Bookings, escrow payments (Stripe Checkout top-ups to wallet, escrow hold on offer accept, release on mutual completion, Stripe Connect Express payouts), in-app plus web-push plus FCM notifications, and messaging. Roles: coach, referee, admin.

**The commitment under examination.** (1) Submission to the Apple App Store and Google Play via a thin Capacitor remote-WebView wrapper pointing at the live site. (2) A live FA trial with real coaches, real referees including under-16s, and real money.

**Who it affects.** Coaches, referees (including minors aged 14 to 17, safeguarding-critical), admins, the FA (trial partner with reputation attached), Apple and Google reviewers (gatekeepers), and Tom (solo operator running two trading names).

**What success looks like.** App approved on both stores; FA trial runs with zero safeguarding incidents; real bookings created, offered, accepted, completed, escrow released correctly with no money loss; notifications actually reach phones; no security breach; no Stripe account freeze; no ICO or GDPR complaint; Tom can support it solo through match-day weekends.

**Key known state used to ground the scenarios.**
- Web push is broken in production now: VAPID keypair mismatch, zero pushes leave the server, but in-app rows write fine so it looks healthy. Flagged as the FA-trial blocker. Fix is config, not code, and includes purging stale subs after redeploy.
- Native push not provisioned: no APNs key, no google-services.json.
- Apple 4.2 risk on the thin wrapper, noted as "not a hard blocker"; no Sign in with Apple.
- App-store-readiness code merged (PR #39): account deletion, UGC moderation, suspension, native top-up gating, GDPR export, store-grade legal.
- Migrations 0155/0158/0159/0160 applied directly to prod via MCP on 3 June; migration tracking historically reset; repo filenames do not all match remote tracking; RUN_THIS_NOW.sql is loose scratch SQL.
- Account deletion, suspension, notifications and thread creation depend on createAdminClient() (service-role), which returns null and fails soft if SUPABASE_SERVICE_ROLE_KEY is missing. Confirming the key in all envs is an open task.
- support@whistleconnect.co.uk is cited in privacy policy, terms and a branded security PDF; making it a real monitored mailbox is an open task.
- The security PDF claims "Whistle Connect Ltd, Data Controller (UK GDPR)", "aligned with UK GDPR and the DPA 2018", "deletable on demand", "3 fields to the FA", "0 card numbers stored", "100% RLS".
- Advisor lint 0029, accepted-but-open: any authenticated user can call SECURITY DEFINER RPCs directly via /rest/v1/rpc, bypassing server-action guards (confirm_booking, mark_booking_complete, wallet_withdraw_*, charge_sos_fee, escrow_refund, claim_sos_booking). confirm_booking has no "already held" guard and overwrites escrow_amount_pence.
- Safeguarding: DOB at registration, min age 14, under-16 locked pending parental consent (DB trigger), under-16 in-app messaging hard-blocked with age at today (button replaced with "email the parent"), eligibility computed at match date. NULL DOB treated as eligible.
- Tom is a solo operator; the Onesign standing SLA elsewhere is four-hour acknowledgement / 48-hour fix, Monday to Saturday.

**Tom's standing failure patterns (watched for throughout).** Underprices and underscopes his own work; carries expansion-blocking technical debt into builds without naming it.

---

## 2. The frame

It is December 2026. The FA trial ran, or tried to. The app went to the stores, or tried to. It failed. We are looking back to understand precisely how it died.

---

## 3. Failure reasons generated (11)

1. Apple Guideline 4.2 rejection of the thin Capacitor wrapper.
2. Heightened app-store scrutiny of an app where adults can contact minors (UGC / families policy).
3. Notifications never reach real phones (web VAPID still broken or regressed; native APNs/FCM not provisioned).
4. Direct SECURITY DEFINER RPC abuse drains money / corrupts booking state.
5. Missing SUPABASE_SERVICE_ROLE_KEY turns deletion, suspension, notifications and thread creation into silent no-ops.
6. The support@ mailbox is not a real, monitored channel.
7. Regulatory / GDPR gap behind the security-pack claims (no DPIA, ICO registration, lawful basis, Children's Code).
8. Schema and migration drift; no clean rebuild path.
9. Solo-operator capacity collapse during a live, money-handling, minor-involving trial on weekends.
10. Safeguarding incident from an age-gating edge case (NULL DOB, at-today vs at-match-date split). Most dangerous.
11. Marketplace cold-start: two-sided liquidity never seeded together in one geography.

---

## 4. Deep-dive investigations

### Card 1 — Apple Guideline 4.2 rejection of the thin wrapper. Severity: high.

**Story.** The submission slipped quietly. The Capacitor wrapper was a single WebView pointing at the live site, splash screen and icon, done. It passed Tom's own smoke test because it was just the website in a frame. The memory note said 4.2 was "noted, not a hard blocker", so he submitted in late October expecting a rubber stamp. Apple rejected in 36 hours under 4.2: limited experience, does not offer sufficient native functionality, flagged as a repackaged website. No push prompt fired in the native shell because web push does not bridge to APNs, so the reviewer saw zero native behaviour. The third round added Guideline 4.8: email/password sign-up with no Sign in with Apple. Two blockers, neither quick, for a solo operator with no native iOS code. By the trial date the iOS app did not exist; Android shipped via the same wrapper; half the coaches and the under-16 parents were on iPhones, pointed at "add to home screen". The trial looked half-finished to the sponsor it most needed to impress.

**Underlying assumption.** That a thin remote WebView counts as an "app" to Apple, so the wrapper was a packaging step rather than a build of native capability.

**Early warning signs.** The Capacitor project contains zero native plugins and no APNs key; the wrapper only loads a URL. The push permission prompt never appears inside the native iOS shell because web push cannot reach APNs there.

### Card 2 — Heightened store scrutiny of adults contacting minors. Severity: high.

**Story.** The age-rating questionnaire was answered honestly: no mature content. What was not flagged was the structural fact that coaches can initiate contact with referees, and referees can be 14. The reviewer registered as a coach, reached a referee profile, was matched with an adult referee, and so never saw the correct "email the parent" substitution. From their seat it looked like an adult-to-stranger contact platform with no visible age gate at the front door and reporting tools three taps deep inside a thread. Rejection under Guideline 1.2. The resubmission made it worse: a reviewer note explaining the under-16 lock told Apple explicitly that the platform knowingly serves children and facilitates adult contact, tripping the Kids and Families review thread. Google Play flagged a Data Safety mismatch (messages and DOB are shared personal data), went live for nine days, a parent complained, and it was pulled under the adult-child contact policy.

**Underlying assumption.** That the safeguarding controls being correct in code meant they would be legible to a reviewer who never triggers the under-16 path.

**Early warning signs.** A reviewer registering as a coach lands on an adult referee and never sees the parent-email substitution. Reporting and blocking are reachable only inside an open thread, absent from the profile and the store listing's safety description.

### Card 3 — Notifications never reach real phones. Severity: critical. Most likely.

**Story.** The keypair was "fixed" on 14 June: regenerated, both values in Vercel, push-debug showed a matching fingerprint. What nobody did was DELETE FROM push_subscriptions WHERE platform='web', so every pre-existing sub was still bound to the old key and silently 410'd on send. The few subs created after the fix worked in a phone test, which read as "push is back". Sentry quietened because validation now passed; the failures had simply moved downstream to delivery, where nobody was looking. On 2 September a settings tidy reordered Vercel env vars and the private key picked up a trailing newline. Validation correctly refused again. No alarm fired because nobody watched push.failure any more, and in-app rows kept writing perfectly. Native never entered the picture: APNs and google-services.json stayed on the post-trial backlog, so the Capacitor builds registered FCM tokens that resolved to nothing. Through October the symptoms read as user apathy. SOS broadcasts sat unanswered, offers expired in the 24h window unseen, completion nudges never surfaced so escrow released only on the kickoff+48h fallback. The FA judged the trial on responsiveness and called it dead.

**Underlying assumption.** That an in-app notification row being written, plus a green push-debug fingerprint, proves a push actually arrived on a phone.

**Early warning signs.** Median time-to-first-offer-response climbs while in-app open rates stay flat: people act only once they open the app, never from a buzz. push_subscriptions rows accumulate but server-side send success counts (deliveries, not validations) flatline, or are never logged at all.

### Card 4 — Direct SECURITY DEFINER RPC abuse drains money. Severity: critical.

**Story.** Two weeks into the trial a referee notices the wallet figures in his browser network tab and the bare /rest/v1/rpc/ calls underneath. He works out that his own logged-in JWT is accepted by Supabase directly. He calls escrow_refund against a booking he was assigned to, the funds drop back to the coach's wallet, then re-runs confirm_booking with his own price. Because confirm_booking has no "already held" guard and overwrites escrow_amount_pence, the escrow row is now inconsistent: a hold stranded in escrow_pence while the coach is effectively charged twice. He then calls mark_booking_complete for both sides and wallet_withdraw_begin/finalise and pulls a clean payout. Every server-action guard in bookings/actions.ts is bypassed; none run, because the REST endpoint never touches the Next.js layer. The weekly reconcile cron is the only safety net and it only runs Mondays, so the corruption compounds for days. The screenshot of a drained coach wallet lands in the FA pilot lead's inbox mid-trial. The 0029 advisor lint was read, logged as "accepted tradeoff", and left for a post-trial PR. Real money shipped over a documented, unfixed hole.

(Investigator confirmed via 0150_confirm_booking_accepts_price.sql and the CLAUDE.md note that confirm_booking takes a price arg and has no "already held" guard.)

**Underlying assumption.** That attackers would only ever reach the RPCs through the app's server actions, so the server-action checks were treated as the security boundary.

**Early warning signs.** Postgres logs show escrow_refund, confirm_booking or wallet_withdraw_* firing without a matching preceding server-action log line, or at odd rates from one user. The Monday reconcile cron reports balance mismatches and escrow stuck over seven days that no cancellation or dispute explains.

### Card 5 — Missing service-role key turns features into silent no-ops. Severity: critical.

**Story.** The key was set once, locally, and never propagated. The createAdminClient() null guard, written for the cron-from-anon edge case, turned the missing service-role key into a silent amputation. The native build pointed at a Vercel environment where SUPABASE_SERVICE_ROLE_KEY had never been added. Every system path ran its null guard, returned early, and logged nothing loud enough to page a solo operator. The Apple reviewer reached the in-app "Delete my account" flow built to satisfy 5.1.1(v). They tapped it. The block-when-money-in-flight check passed, then the anonymise step called the admin client, hit null, and returned a cheerful success toast while the row sat untouched. Reviewer refreshed, still logged in, still present. Rejected. The same week a coach confirmed a booking, ensureBookingThread no-opped, no thread row, the referee was never reachable. An admin "suspended" an abusive parent who stayed active. Worst of all, a GDPR erasure request came in, Tom clicked delete, saw success, and told the user it was done. It was not. The data persisted for weeks, now a reportable breach.

**Underlying assumption.** That a fail-soft null guard is always safer than a hard failure, when for irreversible legal obligations a silent no-op is the most dangerous outcome of all.

**Early warning signs.** Sentry shows zero msg.flow=ensure-thread.* events for days despite live confirmations: silence, not errors. push-debug confirms VAPID is healthy while bookings quietly accrue no thread rows.

### Card 6 — The support mailbox is a black hole. Severity: high.

**Story.** The mailbox was a forwarding alias set up in five minutes before submission, pointing at personal Gmail, then quietly broke when the whistleconnect.co.uk DNS was migrated during the docs-pack work and the MX record was not recreated. From late October everything to support@ hard-bounced. Nobody noticed, because the address only existed to receive. The App Store reviewer hit it first, emailing to query how under-16 referee data is handled. The mail bounced; with no answer to a safeguarding question they rejected under Guideline 5.1.4. Tom assumed a metadata nit and resubmitted twice before reading the note. Meanwhile a coach who quit emailed asking for deletion, citing the PDF's "deletable on demand". It sat in the bounce void. Day 31 passed. He complained to the ICO, attaching the branded Overview naming "Whistle Connect Ltd" as controller, a company never incorporated. Then on a Saturday the FA emailed about a youth-referee incident and got silence until the following week.

**Underlying assumption.** That a published contact address is a deliverable you tick off once, not a live channel that must be provisioned, tested end to end, and monitored daily.

**Early warning signs.** A test email to support@ never arrives or returns a delivery failure, and no one has ever deliberately sent one. App Store Connect shows a rejection citing "we attempted to contact you" or Guideline 5.1.4, with no matching email in any inbox Tom reads.

### Card 7 — Regulatory gap behind the security-pack claims. Severity: critical.

**Story.** The trial launched on the strength of the branded Security and Data Protection Overview. The technical controls were genuine and accurately described. The mistake was treating engineering controls as the whole of compliance. "Whistle Connect Ltd, Data Controller (UK GDPR)" was printed before anyone confirmed the company was incorporated, ICO-registered, or had paid the data protection fee. No DPIA was written for processing the data of 14-to-17-year-olds at scale, despite that being the clearest mandatory-DPIA trigger in UK law. No Children's Code assessment existed for a service plainly accessed by children. It unravelled in November. A parent of a 15-year-old made a subject access request, then complained to the ICO. The ICO's opening letter asked for the DPIA, the record of processing, the documented lawful basis, and the retention schedule. None existed. The FA's routine due-diligence asked the same and got the same silence. The PDF stopped being reassurance and became the case against him: its confident claims showed the obligations were understood; their absence showed they were not met. The FA paused the trial, and the exposure sat with one solo, possibly uninsured, possibly unincorporated operator.

**Underlying assumption.** That building strong technical data-protection controls is the same thing as being legally compliant, so the paperwork could wait.

**Early warning signs.** A polished public claim of "Data Controller (UK GDPR)" while no DPIA file, ICO registration number, or retention schedule exists in the repo or company records. The first subject access request or parental query arrives with no written procedure for who answers it, or by when.

### Card 8 — Schema and migration drift, no clean rebuild. Severity: high.

**Story.** The reappearing bug starts at 0150, which recreates confirm_booking with CREATE OR REPLACE but omits the search_path pin and the GRANT EXECUTE that 0155 later had to restore. In the repo, 0155 sweeps that regression. But 0155, 0158, 0159 and 0160 were applied directly to production via the Supabase MCP on 3 June, out of band. When Tom later spins up a Supabase branch to test, it replays the tracked history, but 0155's tracking row does not line up with the repo filename, so the branch skips it or stops short. The branch ends up with a confirm_booking that has mutable search_path and no authenticated grant. On the branch, every coach Accept fails silently. Tom "fixes" it with a new 0161 and pushes; but production already had 0155 by hand, so 0161 collides or re-grants what is already correct, while a real change ships against a baseline that does not match live. Later a CREATE OR REPLACE for per-match pricing lands written against the branch baseline, silently dropping the search_path pin again in production, escrow holds compute under a poisoned path, and a coach is double-charged exactly as the pre-0155 era. Neither environment rebuilds the other.

(Investigator confirmed via the repo that 0155 explicitly names confirm_booking as having regressed to mutable search_path and lost grants via 0150's CREATE OR REPLACE.)

**Underlying assumption.** That the ordered .sql files in supabase/migrations/ faithfully rebuild the live production schema, so a branch, rollback or new developer gets the same database.

**Early warning signs.** A fresh branch or db reset produces a different get_advisors lint set than production, or list_migrations shows applied versions with no matching repo filename (0155/0156/0157 already in this state). A bug fixed weeks ago, such as coach Accept failing or a search_path warning on confirm_booking, resurfaces in only one environment after a routine deploy.

### Card 9 — Solo-operator capacity collapse on a match day. Severity: critical.

**Story.** Saturday 11 October, 14:20. Forty-odd fixtures mid-kickoff. A coach marks a match complete; the 15-year-old referee does not, because his push never arrived (the in-app row wrote fine, so nothing looked broken). The coach's 35 pounds sits in escrow. He messages support. There is no address that reaches a rota, only Tom, on an Onesign client call under a four-hour acknowledgement clock. The booking sits half-confirmed and the cron will not release until both marks land or kickoff+48h. The coach reads this as theft. 15:05. A second message arrives through the moderation queue: a parent reports that an adult coach has been contacting their under-16 son directly, outside the app's parent-email gate, after getting the number off a team sheet. This is a safeguarding disclosure needing logging, suspension and escalation to the FA welfare officer within the hour. It lands in the same undifferentiated queue as the payment row. Tom does not see it until 18:40, after the call and a design deadline. By Sunday the coach has opened a card chargeback and posted in the county WhatsApp; three coaches pause bookings. On Monday the FA's first question is not the chargeback. It is "when was the safeguarding report received, and what did you do in the first hour." The honest answer, three and a half hours and no logged action, ends the trial.

**Underlying assumption.** That one person, sharing weekends with two other businesses, could trustably triage real-money and child-safeguarding events in the hours they actually occur.

**Early warning signs.** The moderation queue and disputes have no severity tag and no out-of-band alert; a safeguarding report and a wallet query look identical and only surface when Tom next opens the tab. First-weekend response times are already drifting past two hours, with no published support window or named second responder.

### Card 10 — Safeguarding incident from an age-gate edge case. Severity: critical. Most dangerous.

**Story.** A "club secretary" account registered in October through the email-confirmation flow, not the guided referee wizard, left date_of_birth NULL. It was later flipped to a referee profile by hand during a support fix, so it never passed through handle_new_user's consent-lock branch. NULL DOB is treated as eligible, so search, sendBookingRequest and acceptOffer all waved it through. The account belonged to a 15-year-old. The real damage came from the messaging path. In messages/actions.ts the under-16 block only fires when date_of_birth is truthy: the guard short-circuits to false on a NULL DOB, the "email the parent" substitution never triggers, and a normal in-app thread opened. An adult coach and a child exchanged direct messages, unsupervised, for three weeks before a parent found the conversation and complained to the County FA. The split reference points compound it: eligibility is judged at match date while messaging is judged at today, so a 15-year-old booked the week before their 16th birthday can be lawfully assigned yet message freely on match day as a newly-"adult" user.

(Investigator confirmed in code: the messaging block uses ageOnDate(senderProfile.date_of_birth) only when date_of_birth is truthy, so a NULL DOB bypasses the under-16 messaging guard on the messaging path.)

**Underlying assumption.** That every referee account reaches the system with a non-NULL DOB and through the trigger, so "NULL means legacy adult" was treated as safe rather than as the single highest-risk gap.

**Early warning signs.** Any row in profiles with role='referee' AND date_of_birth IS NULL created after the trial start date (one query; should be zero). A confirmed booking whose referee has an open thread row but no under-16 tag or "email parent" CTA on /app/bookings/[id].

### Card 11 — Marketplace cold-start: no seeded liquidity. Severity: high.

**Story.** The trial launched in one county area but the seeding was lopsided from day one. Referees were onboarded hard because they were the controllable side: roughly forty signed up. Coaches were treated as the side that would "just come" once the FA emailed clubs. They did not. By the second weekend there were eleven coach accounts against forty refs, and most coaches posted nothing because their league already used a WhatsApp ref pool that worked fine. Refs opened the app, saw an empty feed, and stopped checking. Of the eight bookings posted, four hit the under-16 consent lock or age filter (most keen sign-ups were 14 to 16) and returned zero eligible matches near the venue. The geographic split finished it: active coaches clustered around one town, available adult refs thirty-plus miles away, so the distance search returned nobody inside a sensible travel radius even on valid posts. Both sides experienced the same empty screen on first use. By December the trial had produced single-digit completed bookings. The FA read that as "the product does not work", when nothing in the booking, escrow or messaging code had failed; the market was simply never seeded thick enough in one place at one time.

**Underlying assumption.** That building the matching software well was the hard part, and supply and demand would show up on their own rather than needing to be seeded together in the same town and fixture window.

**Early warning signs.** A lopsided sign-up ratio in week one (forty refs, eleven coaches) combined with searches returning zero results. Day-one users who search once, get an empty screen, and never return.

---

## 5. Synthesis

**Most likely failure: notifications never reach phones (card 3).** It is the only failure already happening in production today. The fix is multi step and its back half is easy to skip; native APNs and FCM are not provisioned at all; and the failure masquerades as success because in-app rows write fine. A trial whose pitch is fast referee matching, run on an app where no phone buzzes, reads as apathy and dies quietly. Close seconds: a near-certain Apple 4.2 rejection cycle (card 1) and marketplace cold-start (card 11).

**Most dangerous failure: a safeguarding incident from an age-gate gap (card 10).** Confirmed in code: the under-16 messaging block only fires when date_of_birth is truthy, so any referee account with a NULL DOB bypasses it and an adult can message a child in app. NULL DOB is treated as eligible. One incident ends the trial; the harm to a child and the fallout outlive the product. Insure against this regardless of probability.

**The hidden assumption: built equals working.** That a control existing in the codebase is the same as the control working in production on the unhappy path. An in-app row equals a delivered push; a success toast equals a deleted account; a messaging block in code equals a protected child; RLS plus Stripe equals GDPR compliance; a printed support address equals a working channel; .sql files equal a reproducible schema; a server-action guard equals an enforced security boundary. Every card is a gap between "we built it" and "we proved it end to end, including the failure path and the malicious path." A close second, commercial: that the trial rides on software quality, when it actually rides on seeded liquidity, operational response and safeguarding process, none of which are code.

### The revised plan

- **R1 (card 3).** Prove a push lands on a physical phone before anything else: regenerate VAPID, set both Vercel vars clean, redeploy, purge stale web subs, re-grant on a real device, confirm the buzz. Add a server-side delivery counter (actual send results, not validation) and a Sentry alert on push.failure. Provision APNs and google-services.json before the native build, or accept and state that native has no push.
- **R2 (cards 10, 2).** Make NULL DOB fail closed: exclude NULL-DOB referees from search/offer/accept, treat NULL DOB as under-16 in messages/actions.ts, add a DB constraint forbidding a referee row without a DOB, run the zero-row query, and reconcile or document the at-today vs at-match-date split.
- **R3 (card 4).** Treat the REST RPC surface as the boundary: add auth.uid() ownership guards inside the money/booking SECDEF RPCs or move them to a private schema; add the "already held" guard to confirm_booking. Advisor 0029 is no longer acceptable with real money in front of the FA.
- **R4 (card 5).** Make irreversible system paths fail loud: throw and surface an error (never a success toast) when createAdminClient() is null on deletion/suspension/erasure; confirm SUPABASE_SERVICE_ROLE_KEY in every env and redeploy; add a health check that fails visibly if it is absent.
- **R5 (cards 6, 7, 9).** Stand up the non-code obligations: a real monitored support mailbox tested end to end; ICO registration, a DPIA for 14-to-17 data, documented lawful basis and retention, a Children's Code check before printing "Data Controller"; a one-page safeguarding incident procedure with the FA welfare contact and a tagged, alerting path for reports.
- **R6 (cards 1, 2).** De-risk the store submission: add a genuine native capability (native push registration), surface reporting/blocking on the profile and in the listing, decide Sign in with Apple, write reviewer notes with a test path that hits the parent-email substitution, and submit early enough to absorb two rejection cycles.
- **R7 (card 8).** Reconcile the migration history with production so a fresh db reset reproduces live; delete RUN_THIS_NOW.sql; confirm get_advisors on a fresh branch matches prod before writing any new migration.
- **R8 (card 11).** Seed both sides in one small geography and fixture window; do not count locked under-16s as supply; agree the success metric (completed bookings, not signups) with the FA up front.

### Pre-launch checklist

1. A real push received on a physical iPhone and Android, with a server-side delivery log and a Sentry alert armed on push.failure. (Card 3)
2. SQL returns zero referee rows with NULL DOB created after trial start; a test under-16 account and a NULL-DOB account both cannot message a coach and show the parent-email CTA; a written incident procedure with the FA welfare contact exists. (Cards 10, 9)
3. From a plain logged-in browser session, a direct POST to /rest/v1/rpc/escrow_refund and /rest/v1/rpc/wallet_withdraw_begin is rejected by the database. (Card 4)
4. With the service-role key deliberately unset in a preview env, account deletion shows an error not a success toast; the key is confirmed set and deployed in prod; a reviewer can complete in-app deletion end to end. (Card 5)
5. A test email to support@ arrives in an inbox read daily; ICO registration number, DPIA and retention policy exist as files; every claim in the security PDF is individually true. (Cards 6, 7)
