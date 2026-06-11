'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterFormData } from '@/lib/types'
import { isValidFANumber } from '@/lib/utils'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import {
    validate,
    signInSchema,
    signUpSchema,
    signUpGenericSchema,
    finishSetupSchema,
    resetPasswordRequestSchema,
    updatePasswordSchema,
} from '@/lib/validation'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { sendFAVerificationEmail } from '@/lib/email/fa-verification'
import { sendParentConsentEmail } from '@/lib/email/parent-consent'
import { ageOnDate, PARENTAL_CONSENT_AGE } from '@/lib/constants'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves the canonical site URL for constructing email redirect links.
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to VERCEL_URL, then localhost.
 */
function getSiteUrl(): string {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return 'http://localhost:3000'
}

/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows relative paths starting with / (no protocol-relative //evil.com).
 */
function sanitizeRedirectUrl(url: string): string {
    // Must start with exactly one slash and not be a protocol-relative URL
    if (url.startsWith('/') && !url.startsWith('//')) {
        return url
    }
    return '/app'
}

/**
 * Polls for a profile record to appear after the auth trigger fires.
 * Uses increasing delays (200ms, 400ms, 600ms, 800ms, 1000ms) for a max ~3s wait.
 */
async function waitForProfile(
    supabase: SupabaseClient,
    userId: string,
    maxRetries = 5,
    baseDelay = 200
): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle()
        if (data) return true
        await new Promise(r => setTimeout(r, baseDelay * (i + 1)))
    }
    return false
}

export async function signIn(email: string, password: string, redirectTo: string = '/app') {
    const validationError = validate(signInSchema, { email, password })
    if (validationError) {
        return { error: validationError }
    }

    // Rate limit by email to prevent brute-force attacks
    const rateLimitError = checkAuthRateLimit(email.toLowerCase())
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    redirect(sanitizeRedirectUrl(redirectTo))
}

export async function signUp(data: RegisterFormData, redirectTo: string = '/app') {
    const validationError = validate(signUpSchema, data)
    if (validationError) {
        return { error: validationError }
    }

    // Rate limit by email to prevent spam registrations
    const rateLimitError = checkAuthRateLimit(data.email.toLowerCase())
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const supabase = await createClient()

    // Validate FA number format if provided
    if (data.fa_number) {
        if (!isValidFANumber(data.fa_number)) {
            return { error: 'FA number must be 8-10 digits' }
        }

        // Check for duplicate FA numbers
        const { data: existing } = await supabase
            .from('referee_profiles')
            .select('profile_id')
            .eq('fa_id', data.fa_number)
            .maybeSingle()
        if (existing) {
            return { error: 'This FA number is already registered to another referee' }
        }
    }

    // Server-side belt-and-braces — the schema also enforces these, but reject
    // here too in case any caller bypasses validation.
    if (!data.terms_accepted) {
        return { error: 'You must accept the Terms of Service to create an account' }
    }
    if (!data.privacy_accepted) {
        return { error: 'You must accept the Privacy Policy and FA safeguarding consent to create an account' }
    }

    // Create auth user with metadata. The *_accepted_at fields give us
    // server-stamped records of each consent (a client timestamp would be
    // untrusted) — useful for safeguarding audit trails when sharing data
    // with the FA.
    const consentAcceptedAt = new Date().toISOString()
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                role: data.role,
                full_name: data.full_name,
                phone: data.phone || null,
                postcode: data.postcode || null,
                date_of_birth: data.date_of_birth || null,
                // The handle_new_user trigger reads these from metadata to
                // persist the referee's FA number (fa_id, item 3) and to create
                // the parental_consents row for under-18s (item 4). Without them
                // here the trigger has nothing to act on — the FA number was
                // dropped and the consent row/approval email never created.
                fa_number: data.fa_number || null,
                parent_email: data.parent_email || null,
                terms_accepted_at: consentAcceptedAt,
                privacy_accepted_at: consentAcceptedAt,
            },
        },
    })

    if (authError) {
        console.error('Auth signup error:', authError)
        // Provide more specific error messages
        if (authError.message.includes('Database error saving new user')) {
            return {
                error: 'Unable to create account. Please try again or contact support if the problem persists.'
            }
        }
        if (authError.message.includes('already registered')) {
            return { error: 'An account with this email already exists. Please sign in instead.' }
        }
        return { error: authError.message }
    }

    if (!authData.user) {
        return { error: 'Failed to create user account' }
    }

    // Check if email confirmation is required
    if (authData.user && !authData.session) {
        // User created but needs email confirmation
        return {
            success: true,
            message: 'Please check your email to confirm your account before signing in.'
        }
    }

    // If we have a session, user is logged in
    // The database trigger should have created the profile
    // Poll with backoff instead of a fixed delay
    const profileCreated = await waitForProfile(supabase, authData.user.id)

    if (!profileCreated) {
        console.error('Profile not created by trigger after retries')

        // Try to create profile using admin client (bypasses RLS)
        const adminClient = createAdminClient()
        if (adminClient) {
            const { error: insertError } = await adminClient
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    role: data.role,
                    full_name: data.full_name,
                    phone: data.phone || null,
                    postcode: data.postcode || null,
                    date_of_birth: data.date_of_birth || null,
                })

            if (insertError) {
                console.error('Admin profile insert failed:', insertError)
            } else {
                // If referee, create referee_profile.
                // is_available: true documented in code rather than relying
                // solely on the DB default (migration 0146) — keeps the signup
                // contract explicit and survives column-default changes.
                if (data.role === 'referee') {
                    await adminClient
                        .from('referee_profiles')
                        .insert({
                            profile_id: authData.user.id,
                            fa_id: data.fa_number || null,
                            fa_verification_status: data.fa_number ? 'pending' : 'not_provided',
                            is_available: true,
                        })
                } else if (data.fa_number) {
                    // Store FA number in user metadata for coaches
                    await adminClient.auth.admin.updateUserById(authData.user.id, {
                        user_metadata: { fa_number: data.fa_number }
                    })
                }
            }
        } else {
            // Fallback to regular client (may fail due to RLS)
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    role: data.role,
                    full_name: data.full_name,
                    phone: data.phone || null,
                    postcode: data.postcode || null,
                    date_of_birth: data.date_of_birth || null,
                })

            if (insertError) {
                console.error('Manual profile insert failed:', insertError)
            }

            // If referee, create referee_profile (see comment above re: is_available).
            if (data.role === 'referee') {
                await supabase
                    .from('referee_profiles')
                    .insert({
                        profile_id: authData.user.id,
                        fa_id: data.fa_number || null,
                        fa_verification_status: data.fa_number ? 'pending' : 'not_provided',
                        is_available: true,
                    })
            }
        }
    }

    // Geocode postcode and store lat/lon (fire-and-forget, don't block signup)
    if (data.postcode) {
        geocodePostcode(data.postcode).then(async (geo) => {
            if (geo) {
                const client = createAdminClient() || supabase
                await client
                    .from('profiles')
                    .update({ latitude: geo.lat, longitude: geo.lng })
                    .eq('id', authData.user!.id)
            }
        }).catch(() => { /* geocoding is best-effort at signup */ })
    }

    // Under-18 referee: the trigger has already locked the account
    // (parental_consent_status='awaiting') and created the parental_consents
    // row. Send the parent the one-click approve email (best-effort — the
    // account stays locked regardless, so a missed send is recoverable).
    if (
        data.role === 'referee' &&
        data.parent_email &&
        data.date_of_birth &&
        ageOnDate(data.date_of_birth) < PARENTAL_CONSENT_AGE
    ) {
        const adminClient = createAdminClient()
        if (adminClient) {
            const { data: consentRow } = await adminClient
                .from('parental_consents')
                .select('response_token')
                .eq('referee_id', authData.user.id)
                .maybeSingle()
            if (consentRow?.response_token) {
                sendParentConsentEmail({
                    parentEmail: data.parent_email,
                    childName: data.full_name,
                    responseToken: consentRow.response_token,
                }).catch(() => { /* email is best-effort; account stays locked regardless */ })
            } else {
                console.error('Parental consent row missing for', authData.user.id)
            }
        } else {
            console.error('Parental consent: admin client unavailable (missing service role key)')
        }
    }

    // Send FA verification email if referee provided an FA number (fire-and-forget)
    if (data.role === 'referee' && data.fa_number) {
        sendFAVerificationEmail({
            refereeName: data.full_name,
            faId: data.fa_number,
            county: null, // County not known at signup, will be set later
        }).catch(() => { /* email is best-effort at signup */ })
    }

    return { success: true, redirectTo: sanitizeRedirectUrl(redirectTo) }
}

/**
 * Generic (deferred-role) signup for the World Cup sweepstake funnel. Creates a
 * full Whistle Connect account WITHOUT picking coach/referee:
 * profiles.setup_complete=false + the existing 'coach' placeholder role. The
 * /app gate (middleware) later routes them to /finish-setup. No DOB/FA/referee
 * fields are touched here — the under-18 safeguarding gate is enforced at
 * /finish-setup when (and only when) the user actively chooses the referee role.
 */
export async function signUpGeneric(
    data: { email: string; password: string; full_name: string; terms_accepted: boolean; privacy_accepted: boolean },
    redirectTo: string = '/world-cup',
) {
    const validationError = validate(signUpGenericSchema, data)
    if (validationError) {
        return { error: validationError }
    }

    const rateLimitError = checkAuthRateLimit(data.email.toLowerCase())
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const supabase = await createClient()
    const consentAcceptedAt = new Date().toISOString()

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                role: 'coach', // placeholder; overwritten at /finish-setup
                full_name: data.full_name,
                // The trigger (0168) reads this and persists
                // profiles.setup_complete=false, gating the main app.
                setup_complete: false,
                terms_accepted_at: consentAcceptedAt,
                privacy_accepted_at: consentAcceptedAt,
            },
        },
    })

    if (authError) {
        console.error('Generic signup error:', authError)
        if (authError.message.includes('already registered')) {
            return { error: 'An account with this email already exists. Please sign in instead.' }
        }
        if (authError.message.includes('Database error saving new user')) {
            return { error: 'Unable to create account. Please try again or contact support if the problem persists.' }
        }
        return { error: authError.message }
    }

    if (!authData.user) {
        return { error: 'Failed to create user account' }
    }

    if (authData.user && !authData.session) {
        return {
            success: true,
            message: 'Please check your email to confirm your account, then come back to set up your sweepstake.',
        }
    }

    // Belt-and-braces: if the trigger didn't create the profile, insert it with
    // setup_complete=false via the admin client so the gate still fires.
    const profileCreated = await waitForProfile(supabase, authData.user.id)
    if (!profileCreated) {
        const adminClient = createAdminClient()
        if (adminClient) {
            await adminClient.from('profiles').insert({
                id: authData.user.id,
                role: 'coach',
                full_name: data.full_name,
                setup_complete: false,
            })
        }
    }

    return { success: true, redirectTo: sanitizeRedirectUrl(redirectTo) }
}

/**
 * Completes a generic account: the user picks coach/referee and supplies the
 * role-specific details. This is the second half of registration, deferred.
 *
 * For referees it reproduces the exact safeguarding behaviour of signUp +
 * handle_new_user: creates referee_profiles, persists the FA number, and — when
 * under 18 — LOCKS the account (parental_consent_status='awaiting'), creates the
 * parental_consents row, and sends the one-click parent approval email. The gate
 * moves here; it never disappears.
 */
export async function completeAccountSetup(data: {
    role: 'coach' | 'referee'
    phone?: string
    postcode?: string
    fa_number?: string
    date_of_birth?: string
    parent_email?: string
}) {
    const validationError = validate(finishSetupSchema, data)
    if (validationError) {
        return { error: validationError }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Unauthorized' }
    }

    // FA number format + uniqueness (referees only).
    if (data.role === 'referee' && data.fa_number) {
        if (!isValidFANumber(data.fa_number)) {
            return { error: 'FA number must be 8-10 digits' }
        }
        const { data: existing } = await supabase
            .from('referee_profiles')
            .select('profile_id')
            .eq('fa_id', data.fa_number)
            .neq('profile_id', user.id)
            .maybeSingle()
        if (existing) {
            return { error: 'This FA number is already registered to another referee' }
        }
    }

    const admin = createAdminClient()
    if (!admin) {
        return { error: 'Account setup is temporarily unavailable. Please try again shortly.' }
    }

    // 1. Promote the profile to the chosen role and mark setup complete.
    const { error: profileError } = await admin
        .from('profiles')
        .update({
            role: data.role,
            phone: data.phone || null,
            postcode: data.postcode || null,
            date_of_birth: data.date_of_birth || null,
            setup_complete: true,
        })
        .eq('id', user.id)

    if (profileError) {
        console.error('completeAccountSetup profile update failed:', profileError)
        return { error: 'Could not save your details. Please try again.' }
    }

    // 2. Referee: create referee_profiles + run the under-18 consent gate.
    if (data.role === 'referee') {
        const underage = !!data.date_of_birth && ageOnDate(data.date_of_birth) < PARENTAL_CONSENT_AGE

        await admin
            .from('referee_profiles')
            .upsert({
                profile_id: user.id,
                fa_id: data.fa_number || null,
                fa_verification_status: data.fa_number ? 'pending' : 'not_provided',
                is_available: true,
                // FAIL CLOSED: lock under-18s (and any missing DOB) pending consent.
                parental_consent_status: underage || !data.date_of_birth ? 'awaiting' : 'not_required',
            }, { onConflict: 'profile_id' })

        if (underage && data.parent_email && data.date_of_birth) {
            const { data: consentRow } = await admin
                .from('parental_consents')
                .upsert({
                    referee_id: user.id,
                    parent_email: data.parent_email,
                    child_name: (await getDisplayName(admin, user.id)) || 'Referee',
                    child_dob: data.date_of_birth,
                    status: 'awaiting',
                }, { onConflict: 'referee_id' })
                .select('response_token')
                .maybeSingle()

            if (consentRow?.response_token) {
                sendParentConsentEmail({
                    parentEmail: data.parent_email,
                    childName: (await getDisplayName(admin, user.id)) || 'Referee',
                    responseToken: consentRow.response_token,
                }).catch(() => { /* best-effort; account stays locked regardless */ })
            }
        }

        if (data.fa_number) {
            const refereeName = (await getDisplayName(admin, user.id)) || 'Referee'
            sendFAVerificationEmail({ refereeName, faId: data.fa_number, county: null })
                .catch(() => { /* best-effort */ })
        }
    }

    // 3. Geocode postcode (best-effort, non-blocking).
    if (data.postcode) {
        geocodePostcode(data.postcode).then(async (geo) => {
            if (geo) {
                await admin
                    .from('profiles')
                    .update({ latitude: geo.lat, longitude: geo.lng })
                    .eq('id', user.id)
            }
        }).catch(() => { /* best-effort */ })
    }

    return { success: true, redirectTo: '/app' }
}

/** Fetch a profile's full_name for emails (small helper, admin client). */
async function getDisplayName(admin: SupabaseClient, userId: string): Promise<string | null> {
    const { data } = await admin.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    return data?.full_name ?? null
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}

/**
 * Sends a password reset email using Supabase's built-in flow.
 * Always returns a success response (even if the email is not registered)
 * to avoid leaking which addresses exist in the database.
 */
export async function requestPasswordReset(email: string) {
    const validationError = validate(resetPasswordRequestSchema, { email })
    if (validationError) {
        return { error: validationError }
    }

    // Rate limit by email to prevent abuse of the email-sending endpoint
    const rateLimitError = checkAuthRateLimit(email.toLowerCase())
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const supabase = await createClient()

    // The link lands on /auth/callback which exchanges the code for a session
    // and then redirects to /auth/reset-password where the user sets a new password.
    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    })

    if (error) {
        // Log for observability but don't leak whether the account exists
        console.error('resetPasswordForEmail error:', error.message)
    }

    return {
        success: true,
        message: 'If an account exists for that email, a reset link has been sent.',
    }
}

/**
 * Updates the current user's password. The user must already have an
 * authenticated session — this is populated by the /auth/callback handler
 * after they click the link in their reset email.
 */
export async function updatePassword(password: string) {
    const validationError = validate(updatePasswordSchema, { password })
    if (validationError) {
        return { error: validationError }
    }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Your reset link has expired. Please request a new one.' }
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

export async function getSession() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

export async function getCurrentProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return profile
}
