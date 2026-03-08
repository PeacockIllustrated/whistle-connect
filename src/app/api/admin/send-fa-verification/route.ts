import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFAVerificationEmail } from '@/lib/email/fa-verification'

export async function POST(request: NextRequest) {
    try {
        // Verify admin auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { refereeName, faId, county } = body

        if (!refereeName || !faId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const result = await sendFAVerificationEmail({ refereeName, faId, county })

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('FA verification email error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
