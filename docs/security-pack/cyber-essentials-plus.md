# Cyber Essentials Plus — readiness & evidence pack

> Scope of this document: maps the Whistle Connect **production build + cloud
> configuration** to the five Cyber Essentials technical controls, records the
> code-side hardening completed for certification, and lists the
> **organisation-side evidence** an IASME assessor will need that does NOT live
> in this repository.
>
> Last updated: 2026-06-16.

## What Cyber Essentials Plus actually assesses

Cyber Essentials certifies an **organisation** (not an app) against five
technical control themes. **Plus** adds a hands-on audit by a licensed
certification body: an authenticated vulnerability scan of a device sample, a
patch-level audit, a malware-protection test, an email/web-browser test, and an
MFA check. A large part of the pass/fail therefore lives in the **device estate
and admin practices**, which this codebase cannot evidence. Treat the
application as roughly one-third of the picture.

The five controls:

1. Firewalls / boundary
2. Secure configuration
3. Security update management (patching)
4. User access control
5. Malware protection

---

## Control-by-control status

### 1. User access control

| Item | Status | Evidence |
|---|---|---|
| **MFA on administrative access** | ✅ Enforced in app | Every `/app/admin/*` route requires an `aal2` (MFA-verified) session via `src/app/app/admin/layout.tsx`. Admins without a verified TOTP factor are sent to `/app/security/two-factor` to enrol; on subsequent logins they are stepped up before any admin page renders. Self-service TOTP enrolment is available to all users from Profile → Security & two-factor. |
| **MFA on cloud provider consoles** | ⚠️ Org action | Vercel, Supabase, Stripe, GitHub, Cloudflare/DNS, Make/Zoho must each have MFA enabled for every admin. Capture screenshots per provider (see checklist). |
| **Password strength** | ✅ 12-char minimum | `signUpSchema`, `signUpGenericSchema`, `updatePasswordSchema` in `src/lib/validation.ts` enforce ≥12 chars, mirrored in the register, generic-signup and reset-password UIs. Meets CE's "≥12 characters" password option without relying on a breached-password service. |
| **Breached-password blocking (HIBP)** | ⚠️ Recommended toggle | Supabase Auth → Policies → "Leaked password protection". Requires **Supabase Pro**. Optional once the 12-char minimum is in place, but recommended. |
| **Brute-force protection** | ✅ | Per-email in-memory limiter + shared Postgres fixed-window counter (`rate_limit_counters`, migration 0172) on sign-in / signup / reset. |
| **Admin self-registration blocked** | ✅ | `handle_new_user` role allowlist + zod drop `'admin'` (migration 0170). |
| **RBAC + least privilege** | ✅ | `role` column + RLS + `requireAdmin()` server-action guards + `admin_audit_log` (migration 0166). |
| **Separate admin / daily-use accounts** | ⚠️ Org action | Confirm admins do not use their admin account for routine browsing/email. |

### 2. Secure configuration

| Item | Status | Evidence |
|---|---|---|
| Security response headers | ✅ | `next.config.ts`: HSTS (preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. |
| **Content-Security-Policy** | ✅ Added | `next.config.ts` global header. Enforcing, with `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and a Stripe frame allowlist. `connect-src`/`img-src` use `https:`/`wss:` so no third-party endpoint (Supabase realtime, Stripe, Mapbox, the Sentry `/monitoring` tunnel) is blocked. Flip to `Content-Security-Policy-Report-Only` if a future change needs an observation window. |
| Secrets handling | ✅ | All secrets in env vars; `.env.vapid` gitignored; service-role key server-only. |
| Directly-callable `SECURITY DEFINER` RPCs | ⚠️ Accepted / follow-up | Supabase advisor 0029: money RPCs (`confirm_booking`, `mark_booking_complete`, `wallet_withdraw_*`, etc.) are executable by the `authenticated` role over REST. **Not a CE control requirement.** A blanket `REVOKE` is unsafe — these functions are invoked *as* the `authenticated` role by the app's server actions, so revoking would break booking confirmation, completion and withdrawals. Safe fix = per-function `auth.uid()` guards (own, separately-tested PR). The genuinely dangerous holes (`anon`/`PUBLIC` execute, `escrow_refund`, `claim_sos_booking`, `create_notification`) are already closed by migrations 0155 / 0162 / 0163. |
| PostGIS in `public` schema | ⚠️ Accepted | Advisor 0013/0014. Static SRID lookup; migration role can't relocate extension-owned objects. Same accepted stance as migration 0138. |

### 3. Security update management (patching)

| Item | Status | Evidence |
|---|---|---|
| Dependency vulnerabilities | ✅ No high/critical | `npm audit` after `npm audit fix`: **0 high, 0 critical**. The prior single high (`vite`/`launch-editor`, dev/test-only, Windows-only) is resolved. |
| Remaining advisories | ⚠️ Accepted / monitored | 3 **moderate** — all `postcss <8.5.10` pinned *inside* `next@16.2.7`'s bundled copy (XSS in CSS stringify, build-time only). The only npm-offered fix is `--force` → `next@9.3.3`, an unsupported downgrade. Resolves when Next.js ships a patched bundle; track Next releases. A "no fix available that doesn't break supported software" position is acceptable under CE patch management. |
| Framework currency | ✅ | Next.js 16.2.7 (past the CVE-2025-29927 middleware-bypass line). |
| **Device OS / browser patch cadence (≤14 days, high/critical)** | ⚠️ Org action | The audited core of this control. Evidence the OS + browser update policy and timeliness on all in-scope devices. |
| **No unsupported / end-of-life software** | ⚠️ Org action | Inventory OS versions; nothing past vendor end-of-support. |

### 4. Malware protection — ⚪ org / endpoint scope

PaaS (Vercel/Supabase): no self-managed servers to patch. The control applies to
**endpoints** — Defender/AV enabled, plus the assessor's email + web-browser
malware test. Evidence per device.

### 5. Firewalls / boundary — ⚪ org / endpoint scope

No self-managed infrastructure; the boundary is the office/home router + devices
plus the providers' managed firewalls. Confirm routers use non-default admin
credentials and have no unnecessary inbound rules.

---

## Hardening completed for certification (this PR)

- **Admin MFA enforced** — `aal2` gate on all `/app/admin/*` routes; self-service
  TOTP enrolment + step-up at `/app/security/two-factor`.
- **Password minimum raised 8 → 12** across all server schemas and client UIs.
- **Content-Security-Policy added** (enforcing, Stripe/Supabase/Mapbox-safe).
- **Dependency patching** — `npm audit fix`; high-severity advisory cleared.

### Deliberately NOT changed (safety)

- **SECDEF RPC `authenticated` grants** — see Secure configuration above.
  Blanket revoke would break production money flows; proper fix is its own
  tested PR. Not a CE control gate.

---

## Organisation-side evidence checklist (not in this repo)

- [ ] Asset inventory: every in-scope device (laptops, desktops, mobiles, BYOD) + every cloud service (Vercel, Supabase, Stripe, GitHub, Make, Cloudflare/DNS, Sentry).
- [ ] MFA enabled + screenshotted on every cloud provider admin console.
- [ ] Device OS + browser auto-update enabled; critical/high patches within 14 days (policy + sample evidence).
- [ ] No end-of-life software in scope.
- [ ] Malware protection (Defender/AV) enabled on all endpoints.
- [ ] Disk encryption (BitLocker/FileVault) + screen-lock with password/biometric on all devices.
- [ ] Separate admin vs daily-use accounts; standard users are not local admins.
- [ ] Router/firewall: default credentials changed, no unnecessary inbound rules.
- [ ] Account joiners/movers/leavers process; review of who holds admin.
- [ ] (Recommended) Supabase leaked-password protection enabled (needs Supabase Pro).

---

## Post-deploy verification

After deploying this change, smoke-test the CSP and MFA:

1. Load the app — confirm Stripe checkout, the Mapbox map, realtime chat, and
   avatar images all work (CSP did not block them). If anything breaks, flip the
   `Content-Security-Policy` header to `Content-Security-Policy-Report-Only` and
   re-test.
2. As an admin, visit `/app/admin/referees` → you are redirected to set up 2FA →
   enrol with an authenticator app → you land back in the admin area.
3. Sign out and back in as that admin → confirm you are prompted for the 6-digit
   code before admin pages load.
4. As a coach/referee, Profile → Security & two-factor → optionally enrol.
