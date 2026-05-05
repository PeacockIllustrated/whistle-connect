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
    resetPasswordRequestSchema,
    updatePasswordSchema,
} from '@/lib/validation'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { sendFAVerificationEmail } from '@/lib/email/fa-verification'
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
                })

            if (insertError) {
                console.error('Admin profile insert failed:', insertError)
            } else {
                // If referee, create referee_profile
                if (data.role === 'referee') {
                    await adminClient
                        .from('referee_profiles')
                        .insert({
                            profile_id: authData.user.id,
                            fa_id: data.fa_number || null,
                            fa_verification_status: data.fa_number ? 'pending' : 'not_provided',
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
                })

            if (insertError) {
                console.error('Manual profile insert failed:', insertError)
            }

            // If referee, create referee_profile
            if (data.role === 'referee') {
                await supabase
                    .from('referee_profiles')
                    .insert({
                        profile_id: authData.user.id,
                        fa_id: data.fa_number || null,
                        fa_verification_status: data.fa_number ? 'pending' : 'not_provided',
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
