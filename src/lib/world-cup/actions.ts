'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { dealTeams, shuffle } from './scoring'
import { WC_2026_TEAMS } from './teams-2026'
import type { WcSweepstakeEntry } from './types'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function genShareId(len = 8): string {
    const bytes = crypto.getRandomValues(new Uint8Array(len))
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function cleanNames(names: string[]): string[] {
    return names
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .slice(0, 48)
}

/**
 * Create a sweepstake (status='draft') plus its participant entries. The draw
 * is a separate step (runDraw) so the manage page can animate the reveal.
 */
export async function createSweepstake(input: { name: string; participantNames: string[] }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Please sign in to create a sweepstake' }

    const name = input.name?.trim()
    if (!name || name.length < 2) return { error: 'Give your sweepstake a name' }
    if (name.length > 80) return { error: 'That name is too long' }

    const names = cleanNames(input.participantNames || [])
    if (names.length < 2) return { error: 'Add at least two players' }

    // Insert the sweepstake, retrying on the rare share_id collision.
    let sweepstakeId: string | null = null
    for (let attempt = 0; attempt < 3 && !sweepstakeId; attempt++) {
        const { data, error } = await supabase
            .from('wc_sweepstakes')
            .insert({ organiser_id: user.id, name, share_id: genShareId(), status: 'draft' })
            .select('id')
            .single()
        if (data) {
            sweepstakeId = data.id
        } else if (error && !error.message.includes('duplicate')) {
            console.error('createSweepstake error:', error)
            return { error: 'Could not create the sweepstake. Please try again.' }
        }
    }
    if (!sweepstakeId) return { error: 'Could not create the sweepstake. Please try again.' }

    const { error: entriesError } = await supabase
        .from('wc_sweepstake_entries')
        .insert(names.map((participant_name) => ({ sweepstake_id: sweepstakeId, participant_name })))
    if (entriesError) {
        console.error('createSweepstake entries error:', entriesError)
        return { error: 'Could not add players. Please try again.' }
    }

    revalidatePath('/world-cup/sweepstake')
    return { success: true, id: sweepstakeId }
}

/**
 * Draw the 48 teams out to the entries, as evenly as possible. Organiser-only;
 * idempotent-safe (clears any prior draw so a re-draw works).
 */
export async function runDraw(sweepstakeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: sweepstake } = await supabase
        .from('wc_sweepstakes')
        .select('id, organiser_id')
        .eq('id', sweepstakeId)
        .maybeSingle()
    if (!sweepstake || sweepstake.organiser_id !== user.id) return { error: 'Sweepstake not found' }

    const { data: entries } = await supabase
        .from('wc_sweepstake_entries')
        .select('id')
        .eq('sweepstake_id', sweepstakeId)
        .order('created_at', { ascending: true })
    const entryIds = ((entries as { id: string }[] | null) ?? []).map((e) => e.id)
    if (entryIds.length < 2) return { error: 'Add at least two players before drawing' }

    const { data: teams } = await supabase.from('wc_teams').select('code')
    const codes = ((teams as { code: string }[] | null) ?? []).map((t) => t.code)
    if (codes.length === 0) {
        return { error: 'The tournament teams haven\'t loaded yet. Please try again shortly.' }
    }

    const buckets = dealTeams(shuffle(codes), entryIds.length)
    const rows = entryIds.flatMap((entryId, i) =>
        buckets[i].map((team_code) => ({ sweepstake_id: sweepstakeId, entry_id: entryId, team_code })),
    )

    // Clear any prior draw, then insert fresh assignments.
    await supabase.from('wc_sweepstake_entry_teams').delete().eq('sweepstake_id', sweepstakeId)
    const { error: insertError } = await supabase.from('wc_sweepstake_entry_teams').insert(rows)
    if (insertError) {
        console.error('runDraw insert error:', insertError)
        return { error: 'The draw failed. Please try again.' }
    }

    await supabase.from('wc_sweepstakes').update({ status: 'drawn', updated_at: new Date().toISOString() }).eq('id', sweepstakeId)

    revalidatePath(`/world-cup/sweepstake/${sweepstakeId}`)
    return { success: true }
}

/**
 * Manually set who holds which teams - for groups who've already drawn out of a
 * hat and just want to record it. Replaces any existing assignment. Teams may be
 * left unassigned (spares); a team can't be assigned to two players. Organiser-only.
 */
export async function setManualAssignments(
    sweepstakeId: string,
    assignments: { entryId: string; teamCodes: string[] }[],
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: sweepstake } = await supabase
        .from('wc_sweepstakes')
        .select('id, organiser_id')
        .eq('id', sweepstakeId)
        .maybeSingle()
    if (!sweepstake || sweepstake.organiser_id !== user.id) return { error: 'Sweepstake not found' }

    // Only assign to entries that actually belong to this sweepstake.
    const { data: entries } = await supabase
        .from('wc_sweepstake_entries')
        .select('id')
        .eq('sweepstake_id', sweepstakeId)
    const validEntryIds = new Set(((entries as { id: string }[] | null) ?? []).map((e) => e.id))

    const validCodes = new Set(WC_2026_TEAMS.map((t) => t.code))
    const seen = new Set<string>()
    const rows: { sweepstake_id: string; entry_id: string; team_code: string }[] = []

    for (const a of assignments) {
        if (!validEntryIds.has(a.entryId)) continue
        for (const code of a.teamCodes) {
            if (!validCodes.has(code)) return { error: `Unknown team: ${code}` }
            if (seen.has(code)) return { error: `${code} is assigned to more than one player` }
            seen.add(code)
            rows.push({ sweepstake_id: sweepstakeId, entry_id: a.entryId, team_code: code })
        }
    }

    // Replace the whole assignment atomically-ish: clear then insert.
    await supabase.from('wc_sweepstake_entry_teams').delete().eq('sweepstake_id', sweepstakeId)
    if (rows.length > 0) {
        const { error } = await supabase.from('wc_sweepstake_entry_teams').insert(rows)
        if (error) {
            console.error('setManualAssignments insert error:', error)
            return { error: 'Could not save the assignments. Please try again.' }
        }
    }

    await supabase
        .from('wc_sweepstakes')
        .update({ status: 'drawn', updated_at: new Date().toISOString() })
        .eq('id', sweepstakeId)

    revalidatePath(`/world-cup/sweepstake/${sweepstakeId}`)
    return { success: true }
}

export async function addParticipant(sweepstakeId: string, name: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const trimmed = name.trim()
    if (!trimmed) return { error: 'Enter a name' }

    const { data: sweepstake } = await supabase
        .from('wc_sweepstakes')
        .select('id, organiser_id, status')
        .eq('id', sweepstakeId)
        .maybeSingle()
    if (!sweepstake || sweepstake.organiser_id !== user.id) return { error: 'Sweepstake not found' }
    if (sweepstake.status !== 'draft') return { error: 'Players can only be added before the draw' }

    const { error } = await supabase
        .from('wc_sweepstake_entries')
        .insert({ sweepstake_id: sweepstakeId, participant_name: trimmed })
    if (error) return { error: 'Could not add that player' }

    revalidatePath(`/world-cup/sweepstake/${sweepstakeId}`)
    return { success: true }
}

export async function removeParticipant(entryId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // RLS ensures only the organiser of the parent sweepstake can delete.
    const { error } = await supabase.from('wc_sweepstake_entries').delete().eq('id', entryId)
    if (error) return { error: 'Could not remove that player' }

    revalidatePath('/world-cup/sweepstake')
    return { success: true }
}

export async function deleteSweepstake(sweepstakeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('wc_sweepstakes')
        .delete()
        .eq('id', sweepstakeId)
        .eq('organiser_id', user.id)
    if (error) return { error: 'Could not delete the sweepstake' }

    revalidatePath('/world-cup/sweepstake')
    return { success: true }
}

/**
 * Bind the signed-in account to a participant entry via its claim token. This is
 * how a casual entrant who signed up becomes the owner of their spot.
 */
export async function claimEntry(claimToken: string): Promise<{ success?: true; error?: string; sweepstakeShareId?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Please sign in to claim your spot' }

    const admin = createAdminClient()
    if (!admin) return { error: 'Claiming is temporarily unavailable' }

    const { data: entry } = await admin
        .from('wc_sweepstake_entries')
        .select('id, sweepstake_id, claimed_by')
        .eq('claim_token', claimToken)
        .maybeSingle()
    const e = entry as Pick<WcSweepstakeEntry, 'id' | 'sweepstake_id' | 'claimed_by'> | null
    if (!e) return { error: 'That claim link is invalid' }
    if (e.claimed_by && e.claimed_by !== user.id) return { error: 'That spot has already been claimed' }

    await admin.from('wc_sweepstake_entries').update({ claimed_by: user.id }).eq('id', e.id)

    const { data: sweepstake } = await admin
        .from('wc_sweepstakes')
        .select('share_id')
        .eq('id', e.sweepstake_id)
        .maybeSingle()

    return { success: true, sweepstakeShareId: (sweepstake as { share_id: string } | null)?.share_id }
}
