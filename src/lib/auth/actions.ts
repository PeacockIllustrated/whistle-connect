'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterFormData } from '@/lib/types'
import { isValidFANumber } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

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
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    redirect(redirectTo)
}

export async function signUp(data: RegisterFormData, redirectTo: string = '/app') {
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

    // Create auth user with metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                role: data.role,
                full_name: data.full_name,
                phone: data.phone || null,
                postcode: data.postcode || null,
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

    redirect(redirectTo)
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
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
