# Make.com Email Hub

Single place that sends every transactional email for Whistle Connect. The app
POSTs a small structured payload to **one Make webhook**; a Make scenario routes
on `type` and renders + sends each email. Resend is kept only as a transition
fallback and is removed once the hub is verified live.

> **Account-agnostic.** Nothing in the app hardcodes a Make account, scenario, or
> webhook URL. When the dedicated **Whistle Connect** Make account is created,
> only two env vars change — no code change, no redeploy of logic.

## Env vars (set in Vercel Production)

| Var | Required | Notes |
|---|---|---|
| `MAKE_EMAIL_WEBHOOK_URL` | yes (to enable Make) | The custom-webhook URL from the hub scenario. If unset, the app falls back to Resend. |
| `MAKE_WEBHOOK_SECRET` | recommended | Shared secret sent as `x-wc-email-secret`; the scenario should filter on it so only the app can trigger sends. |

Cutover is just: set both → redeploy/restart → verify → remove `RESEND_API_KEY`
(and the Resend fallback code) in a follow-up.

## Webhook payload (app → Make)

`POST {MAKE_EMAIL_WEBHOOK_URL}` · header `x-wc-email-secret: {MAKE_WEBHOOK_SECRET}`

```json
{
  "type": "parental_consent",
  "to": "parent@example.com",
  "subject": "Parental consent needed for Jamie on Whistle Connect",
  "data": { "childName": "Jamie", "approveUrl": "https://…", "declineUrl": "https://…" },
  "sentAt": "2026-06-10T21:30:00.000Z"
}
```

The app always resolves `to` and builds any action URLs — Make never looks
anything up. `type` is the single source of truth for routing.

## Email types (the tree)

Source of truth: `TransactionalEmailType` in `src/lib/email/send.ts`.

| `type` | `to` | `data` fields | Wired in app? |
|---|---|---|---|
| `parental_consent` | parent/guardian | `childName`, `approveUrl`, `declineUrl` | ✅ live |
| `fa_verification` | County FA contact | `refereeName`, `faId`, `county`, `confirmUrl`, `rejectUrl` | ✅ live |
| `welcome_referee` | referee | `fullName` | ⏳ reserved |
| `welcome_coach` | coach | `fullName` | ⏳ reserved |
| `booking_confirmed` | coach + referee | `matchDate`, `kickoff`, `venue`, `opponent?` | ⏳ reserved |
| `payment_received` | referee | `amount`, `bookingRef` | ⏳ reserved |
| `dispute_opened` | admins | `bookingRef`, `category` | ⏳ reserved |

`✅ live` = the app already POSTs this type. `⏳ reserved` = type exists in the
contract; add the app call-site + a Make branch when we want that email.

## Build the scenario (in the new Make account)

```
Custom Webhook  ──▶  Router (branch on  {{1.type}})
   (x-wc-email-secret filter)   ├─ type = parental_consent   → Email: send
                                ├─ type = fa_verification     → Email: send
                                ├─ type = welcome_referee     → Email: send
                                ├─ … one branch per type …
                                └─ (fallback) → Data store: "email_log" (optional)
```

1. **Custom Webhook** module → copy its URL into `MAKE_EMAIL_WEBHOOK_URL`.
   Add a filter `x-wc-email-secret` header equals `MAKE_WEBHOOK_SECRET`.
2. **Router** with one route per `type` (filter `{{1.type}} = parental_consent`, etc.).
3. Each route → an **Email / Send a message** module (the new account's connected
   mailbox or transactional provider). Map `To = {{1.to}}`, `Subject = {{1.subject}}`,
   and build the HTML body from `{{1.data.*}}` (e.g. the approve/decline buttons
   from `{{1.data.approveUrl}}` / `{{1.data.declineUrl}}`). The existing HTML in
   `src/lib/email/*.ts` is the reference design for each template.
4. Optional **fallback route → Data store** row for an FA-friendly send log
   (type, to, sentAt) — cheap audit trail.
5. **Activate** the scenario.

## Notes / limits

- **Free plan** allows 2 scenarios and 1,000 ops/month; one email ≈ 2–3 ops.
  Fine for the trial; size the plan to expected volume before launch.
- **Supabase auth emails** (signup confirmation, password reset) are sent by
  Supabase, not the app — they can't route through this webhook. Folding them in
  is a separate phase (Supabase custom SMTP, or app-driven sends).
