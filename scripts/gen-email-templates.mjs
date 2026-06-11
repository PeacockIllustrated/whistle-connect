// Generates src/lib/email/templates.ts from the compiled MJML in emails/*.html.
// Pipeline: edit emails/*.mjml → `npx mjml emails/x.mjml -o emails/x.html`
//          → `node scripts/gen-email-templates.mjs`.
// The {{1.data.*}} tokens are preserved in the stored HTML and substituted at
// runtime (HTML-escaping user-supplied values). See docs/make-email-hub.md.
import { readFileSync, writeFileSync } from 'node:fs'

const lit = (html) =>
    '`' + html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'

const pc = readFileSync('emails/parental-consent.html', 'utf8')
const fa = readFileSync('emails/fa-verification.html', 'utf8')
const faAction = readFileSync('emails/fa-verification-action.html', 'utf8')

const out = `// AUTO-GENERATED — do not edit by hand.
// Source: emails/*.mjml (compiled to emails/*.html, then run scripts/gen-email-templates.mjs).
import { escapeHtml } from '@/lib/utils'

const PARENTAL_CONSENT_HTML = ${lit(pc)}

const FA_VERIFICATION_HTML = ${lit(fa)}

const FA_VERIFICATION_ACTION_HTML = ${lit(faAction)}

/** Branded parental-consent email. User-supplied values are HTML-escaped. */
export function parentalConsentHtml(p: { childName: string; approveUrl: string; declineUrl: string }): string {
    return PARENTAL_CONSENT_HTML
        .split('{{1.data.childName}}').join(escapeHtml(p.childName))
        .split('{{1.data.approveUrl}}').join(p.approveUrl)
        .split('{{1.data.declineUrl}}').join(p.declineUrl)
}

/** FA-verification email, reply-to-confirm variant (no one-click token). */
export function faVerificationHtml(p: { refereeName: string; faId: string; county: string }): string {
    return FA_VERIFICATION_HTML
        .split('{{1.data.refereeName}}').join(escapeHtml(p.refereeName))
        .split('{{1.data.faId}}').join(escapeHtml(p.faId))
        .split('{{1.data.county}}').join(escapeHtml(p.county))
}

/** FA-verification email, one-click variant (Confirm / Not found buttons). */
export function faVerificationActionHtml(p: { refereeName: string; faId: string; county: string; confirmUrl: string; rejectUrl: string }): string {
    return FA_VERIFICATION_ACTION_HTML
        .split('{{1.data.refereeName}}').join(escapeHtml(p.refereeName))
        .split('{{1.data.faId}}').join(escapeHtml(p.faId))
        .split('{{1.data.county}}').join(escapeHtml(p.county))
        .split('{{1.data.confirmUrl}}').join(p.confirmUrl)
        .split('{{1.data.rejectUrl}}').join(p.rejectUrl)
}
`

writeFileSync('src/lib/email/templates.ts', out)
console.log('Wrote src/lib/email/templates.ts (' + out.length + ' bytes)')
