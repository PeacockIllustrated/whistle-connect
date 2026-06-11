// Generates src/lib/email/templates.ts from the compiled MJML in emails/*.html.
// Pipeline: edit emails/*.mjml → `npx mjml emails/x.mjml -o emails/x.html`
//          → `node scripts/gen-email-templates.mjs`.
// The {{1.data.*}} tokens are preserved in the stored HTML and substituted at
// runtime (HTML-escaping user-supplied values). See docs/make-email-hub.md.
import { readFileSync, writeFileSync } from 'node:fs'

const lit = (html) =>
    '`' + html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'

// Email clients read these meta tags to honour our dark-mode CSS instead of
// force-inverting. MJML can't emit head meta, so inject them post-compile
// (idempotent) and write back so previews match what's sent.
const COLOR_SCHEME_META =
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">'
function withColorScheme(html) {
    if (html.includes('supported-color-schemes')) return html
    return html.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">' + COLOR_SCHEME_META,
    )
}
function loadTemplate(path) {
    const html = withColorScheme(readFileSync(path, 'utf8'))
    writeFileSync(path, html)
    return html
}

const pc = loadTemplate('emails/parental-consent.html')
const fa = loadTemplate('emails/fa-verification.html')
const faAction = loadTemplate('emails/fa-verification-action.html')

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
