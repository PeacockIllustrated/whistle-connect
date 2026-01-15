'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateProfile } from './actions'

interface ProfileEditFormProps {
    initialData: {
        full_name: string
        postcode: string
        phone: string
    }
    onCancel: () => void
    onSuccess: () => void
}

export function ProfileEditForm({ initialData, onCancel, onSuccess }: ProfileEditFormProps) {
    const [fullName, setFullName] = useState(initialData.full_name)
    const [postcode, setPostcode] = useState(initialData.postcode)
    const [phone, setPhone] = useState(initialData.phone)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const result = await updateProfile({
                full_name: fullName,
                postcode,
                phone
            })

            if (result.error) {
                setError(result.error)
            } else {
                onSuccess()
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
            />

            <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
            />

            <Input
                label="Postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
            />

            <div className="flex gap-3 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    className="flex-1"
                    loading={loading}
                >
                    Save Changes
                </Button>
            </div>
        </form>
    )
}
