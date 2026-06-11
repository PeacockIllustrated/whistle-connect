'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { completeAccountSetup } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'
import { ageOnDate, MINIMUM_REFEREE_AGE, PARENTAL_CONSENT_AGE } from '@/lib/constants'

type Role = 'coach' | 'referee'

const roleOptions: { value: Role; label: string }[] = [
    { value: 'coach', label: 'Coach / Club Manager' },
    { value: 'referee', label: 'Referee' },
]

export function FinishSetupForm() {
    const [role, setRole] = useState<Role>('coach')
    const [phone, setPhone] = useState('')
    const [postcode, setPostcode] = useState('')
    const [faNumber, setFaNumber] = useState('')
    const [dob, setDob] = useState('')
    const [parentEmail, setParentEmail] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const refereeAge = role === 'referee' && dob ? ageOnDate(dob) : null
    const needsParentalConsent =
        refereeAge !== null && refereeAge >= MINIMUM_REFEREE_AGE && refereeAge < PARENTAL_CONSENT_AGE
    const todayStr = new Date().toISOString().split('T')[0]

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (role === 'referee') {
            if (faNumber && !/^\d{8,10}$/.test(faNumber)) {
                setError('FA number must be 8-10 digits')
                return
            }
            if (!dob) {
                setError('Please enter your date of birth')
                return
            }
            const age = ageOnDate(dob)
            if (age < MINIMUM_REFEREE_AGE) {
                setError(`Referees must be at least ${MINIMUM_REFEREE_AGE} years old`)
                return
            }
            if (age < PARENTAL_CONSENT_AGE && !parentEmail) {
                setError("A parent or guardian's email is required for referees under 18")
                return
            }
        }

        setLoading(true)
        try {
            const result = await completeAccountSetup({
                role,
                phone: phone || undefined,
                postcode: postcode || undefined,
                fa_number: role === 'referee' ? faNumber || undefined : undefined,
                date_of_birth: role === 'referee' ? dob : undefined,
                parent_email: needsParentalConsent ? parentEmail : undefined,
            })
            if (result?.error) {
                setError(result.error)
                setLoading(false)
            } else {
                // Hard navigation so middleware re-evaluates and the app shell
                // re-renders with the newly chosen role.
                window.location.href = result?.redirectTo || '/app'
            }
        } catch (err: unknown) {
            console.error('Finish setup error:', err)
            setError(err instanceof Error ? err.message : 'An unexpected error occurred')
            setLoading(false)
        }
    }

    return (
        <>
            <div className="mb-6">
                <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--background-soft)] rounded-2xl border border-[var(--border-color)]">
                    {roleOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setRole(option.value)}
                            className={cn(
                                'py-4 px-2 rounded-xl text-center transition-all duration-200 font-bold text-sm outline-none',
                                role === option.value
                                    ? option.value === 'referee'
                                        ? 'bg-[var(--wc-red)] text-white shadow-lg'
                                        : 'bg-[var(--wc-blue)] text-white shadow-lg'
                                    : 'text-[var(--foreground-muted)] hover:bg-[var(--neutral-100)]'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <Input
                    label="Phone (optional)"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07700 900000"
                />

                <Input
                    label={role === 'referee' ? 'Home Postcode' : 'Club Postcode'}
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="SW1A 1AA"
                    hint={role === 'referee' ? 'For matching with nearby games' : 'Your home ground postcode'}
                />

                {role === 'referee' && (
                    <Input
                        label="FA Number (FAN)"
                        type="text"
                        inputMode="numeric"
                        value={faNumber}
                        onChange={(e) => setFaNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 12345678"
                        hint="Your 8-10 digit Football Association registration number"
                        maxLength={10}
                    />
                )}

                {role === 'referee' && (
                    <Input
                        label="Date of Birth"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        max={todayStr}
                        hint="Referees must be at least 14. Under-18s need a parent or guardian to approve the account."
                        required
                    />
                )}

                {needsParentalConsent && (
                    <Input
                        label="Parent / Guardian Email"
                        type="email"
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        placeholder="parent@example.com"
                        hint="We'll email them to approve this account before it can be used for refereeing."
                        required
                    />
                )}

                <div className="pt-2">
                    <Button type="submit" fullWidth loading={loading} size="lg" variant="success">
                        Finish setup
                    </Button>
                </div>
            </form>

            <div className="mt-6 text-center">
                <p className="text-[var(--foreground-muted)] text-sm">
                    Just here for the sweepstake?{' '}
                    <Link href="/world-cup" className="text-[var(--color-primary)] font-medium hover:underline">
                        Back to the World Cup
                    </Link>
                </p>
            </div>
        </>
    )
}
