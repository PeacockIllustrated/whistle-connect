'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateAvatarUrl } from '@/app/app/profile/actions'
import { Button } from '@/components/ui/Button'

interface AvatarUploadProps {
    userId: string
    currentAvatarUrl?: string | null
    onSuccess: (url: string) => void
}

export function AvatarUpload({ userId, currentAvatarUrl, onSuccess }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        // Preview
        const objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${userId}/${fileName}`

            const { error: uploadError, data } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            // Update profile
            const result = await updateAvatarUrl(publicUrl)
            if (result.error) throw new Error(result.error)

            onSuccess(publicUrl)
        } catch (error: any) {
            alert(error.message || 'Error uploading avatar')
            setPreviewUrl(currentAvatarUrl || null)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div
                className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden relative cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
            >
                {previewUrl ? (
                    <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <span>?</span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
            />

            <button
                type="button"
                className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
            >
                {uploading ? 'Uploading...' : 'Change Photo'}
            </button>
        </div>
    )
}
