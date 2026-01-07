'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterFormData } from '@/lib/types'

export async function signIn(email: string, password: string) {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    redirect('/app')
}

export async function signUp(data: RegisterFormData) {
    const supabase = await createClient()

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
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify profile was created
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single()

    if (profileError || !profile) {
        console.error('Profile creation issue:', profileError)
        // Try to manually create the profile as fallback
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
            // Don't fail completely - user is still created in auth
        }

        // If referee, create referee_profile
        if (data.role === 'referee') {
            await supabase
                .from('referee_profiles')
                .insert({ profile_id: authData.user.id })
        }
    }

    redirect('/app')
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
