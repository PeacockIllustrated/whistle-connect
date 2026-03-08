'use client'

import { useState, useTransition } from 'react'
import { Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { rateReferee } from '@/app/app/bookings/actions'
import { useToast } from '@/components/ui/Toast'

interface RatingModalProps {
    bookingId: string
    refereeId: string
    refereeName: string
    onClose: () => void
    onRated: () => void
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
    const [hover, setHover] = useState(0)

    return (
        <div>
            <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1">{label}</label>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => onChange(star)}
                        className="p-0.5 transition-transform hover:scale-110"
                    >
                        <Star
                            className={`w-6 h-6 transition-colors ${(hover || value) >= star
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-[var(--neutral-300)]'
                                }`}
                        />
                    </button>
                ))}
            </div>
        </div>
    )
}

export function RatingModal({ bookingId, refereeId, refereeName, onClose, onRated }: RatingModalProps) {
    const [rating, setRating] = useState(0)
    const [punctuality, setPunctuality] = useState(0)
    const [communication, setCommunication] = useState(0)
    const [professionalism, setProfessionalism] = useState(0)
    const [comment, setComment] = useState('')
    const [isPending, startTransition] = useTransition()
    const { showToast } = useToast()

    const handleSubmit = () => {
        if (rating === 0) {
            showToast({ message: 'Please select an overall rating', type: 'error' })
            return
        }

        startTransition(async () => {
            const result = await rateReferee(bookingId, refereeId, {
                rating,
                punctuality: punctuality || undefined,
                communication: communication || undefined,
                professionalism: professionalism || undefined,
                comment: comment.trim() || undefined,
            })

            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Rating submitted!', type: 'success' })
                onRated()
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl safe-area-bottom">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-[var(--border-color)] p-4 flex items-center justify-between rounded-t-2xl z-10">
                    <h2 className="font-bold text-base">Rate {refereeName}</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-[var(--neutral-100)] flex items-center justify-center hover:bg-[var(--neutral-200)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Overall Rating */}
                    <div className="text-center">
                        <label className="text-sm font-semibold block mb-2">Overall Rating</label>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform hover:scale-125"
                                >
                                    <Star
                                        className={`w-10 h-10 transition-colors ${rating >= star
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-[var(--neutral-300)]'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {rating > 0 && (
                            <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                {['', 'Poor', 'Below Average', 'Good', 'Very Good', 'Excellent'][rating]}
                            </p>
                        )}
                    </div>

                    {/* Sub-ratings */}
                    <div className="space-y-3 p-4 bg-[var(--neutral-50)] rounded-xl">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                            Optional breakdown
                        </p>
                        <StarRating value={punctuality} onChange={setPunctuality} label="Punctuality" />
                        <StarRating value={communication} onChange={setCommunication} label="Communication" />
                        <StarRating value={professionalism} onChange={setProfessionalism} label="Professionalism" />
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1">
                            Comment (optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="How was your experience?"
                            rows={3}
                            maxLength={500}
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
                        />
                    </div>

                    {/* Submit */}
                    <Button
                        fullWidth
                        onClick={handleSubmit}
                        loading={isPending}
                        disabled={rating === 0}
                    >
                        Submit Rating
                    </Button>
                </div>
            </div>
        </div>
    )
}
