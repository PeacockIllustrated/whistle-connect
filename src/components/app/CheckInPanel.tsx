'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { checkInToBooking } from '@/app/app/bookings/actions'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { MapPin, Camera, CheckCircle, AlertTriangle, Upload, X } from 'lucide-react'

interface CheckInPanelProps {
    bookingId: string
    matchDate: string // YYYY-MM-DD
    kickoffTime: string // HH:MM:SS
    venueLabel: string
    isReferee: boolean
    isCoach: boolean
    checkedInAt: string | null
    distanceM: number | null
    accuracyM: number | null
    evidencePath: string | null
}

/** Distance beyond which the UI surfaces a "logged far from venue" notice.
 *  Server action records the same threshold in coach notifications. */
const WARN_DISTANCE_M = 500

export function CheckInPanel({
    bookingId,
    matchDate,
    kickoffTime,
    venueLabel,
    isReferee,
    isCoach,
    checkedInAt,
    distanceM,
    accuracyM,
    evidencePath,
}: CheckInPanelProps) {
    const { showToast } = useToast()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [submitting, setSubmitting] = useState(false)
    const [evidenceSignedUrl, setEvidenceSignedUrl] = useState<string | null>(null)
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [pendingPreview, setPendingPreview] = useState<string | null>(null)
    const [acknowledgedSafeguarding, setAcknowledgedSafeguarding] = useState(false)
    // `now` is in state (not Date.now() during render) so the window-open/
    // window-close gates re-evaluate without violating React purity. Tick
    // every 30s so the action card appears the moment the window opens.
    const [now, setNow] = useState<number>(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(id)
    }, [])

    // Resolve the stored evidence path to a signed URL so both parties can
    // view the photo without making the bucket public. 1-hour expiry — page
    // visits well under that, re-fetched on remount. Render-time guard on
    // `evidencePath` below means a stale signedUrl from a previous path
    // never displays.
    useEffect(() => {
        if (!evidencePath) return
        let cancelled = false
        ;(async () => {
            const { data } = await supabase.storage
                .from('checkin-evidence')
                .createSignedUrl(evidencePath, 60 * 60)
            if (!cancelled) setEvidenceSignedUrl(data?.signedUrl ?? null)
        })()
        return () => {
            cancelled = true
        }
    }, [evidencePath, supabase])

    // Window: open 30 min before kickoff, close 3h after. Outside the window
    // the ref doesn't see the call-to-action; once checked in, the panel
    // stays visible (read-only) for both parties as the audit trail.
    const kickoffAt = new Date(`${matchDate}T${kickoffTime}`)
    const windowOpen = kickoffAt.getTime() - 30 * 60 * 1000
    const windowClose = kickoffAt.getTime() + 3 * 60 * 60 * 1000
    const inWindow = now >= windowOpen && now <= windowClose

    // Don't render anything for the coach pre-checkin; saves them visual
    // noise before the ref has done anything. Ref sees the panel only
    // once the window opens.
    if (!checkedInAt && (!inWindow || isCoach)) return null
    // And anyone else who isn't a participant shouldn't see it at all
    // (defence-in-depth — the parent page also gates).
    if (!isReferee && !isCoach) return null

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPendingFile(file)
        const url = URL.createObjectURL(file)
        setPendingPreview(url)
    }

    const clearPendingFile = () => {
        setPendingFile(null)
        if (pendingPreview) URL.revokeObjectURL(pendingPreview)
        setPendingPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const requestGeolocation = (): Promise<{
        lat: number | null
        lng: number | null
        accuracy: number | null
        denied: boolean
    }> => {
        return new Promise((resolve) => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                resolve({ lat: null, lng: null, accuracy: null, denied: true })
                return
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy ?? null,
                        denied: false,
                    })
                },
                () => {
                    resolve({ lat: null, lng: null, accuracy: null, denied: true })
                },
                { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
            )
        })
    }

    const handleCheckIn = async () => {
        if (submitting) return
        setSubmitting(true)
        try {
            // Step 1 — geolocation. Denial isn't fatal; the server is fine
            // with null lat/lng (just no distance computed). We surface a
            // toast so the ref knows the audit trail is weaker.
            const geo = await requestGeolocation()
            if (geo.denied) {
                showToast({
                    message: 'Location permission denied — checking in without GPS.',
                    type: 'warning',
                })
            }

            // Step 2 — upload evidence if the ref attached one.
            let uploadedPath: string | null = null
            if (pendingFile) {
                const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase()
                const filename = `${Date.now()}.${ext}`
                const path = `${bookingId}/${filename}`
                const { error: uploadError } = await supabase.storage
                    .from('checkin-evidence')
                    .upload(path, pendingFile, {
                        upsert: false,
                        contentType: pendingFile.type || 'image/jpeg',
                    })
                if (uploadError) {
                    showToast({
                        message: `Photo upload failed: ${uploadError.message}`,
                        type: 'error',
                    })
                    setSubmitting(false)
                    return
                }
                uploadedPath = path
            }

            // Step 3 — server action.
            const result = await checkInToBooking(bookingId, {
                lat: geo.lat,
                lng: geo.lng,
                accuracyM: geo.accuracy,
                evidencePath: uploadedPath,
            })

            if (result.error) {
                showToast({ message: result.error, type: 'error' })
                setSubmitting(false)
                return
            }

            if (result.far_from_venue) {
                showToast({
                    message: `Checked in — but logged ${Math.round(result.distance_m ?? 0)}m from the venue.`,
                    type: 'warning',
                })
            } else {
                showToast({ message: 'Checked in. The coach has been notified.', type: 'success' })
            }
            clearPendingFile()
        } catch (err) {
            showToast({
                message: err instanceof Error ? err.message : 'Check-in failed',
                type: 'error',
            })
            setSubmitting(false)
        }
    }

    // ── Already checked in: read-only view for both parties ───────────
    if (checkedInAt) {
        const isFar = distanceM != null && distanceM > WARN_DISTANCE_M
        const checkedInDate = new Date(checkedInAt)
        return (
            <div className="card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)]">CHECK-IN</h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        Confirmed
                    </span>
                </div>

                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                            Referee checked in at {checkedInDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                            {distanceM != null ? (
                                <>
                                    {Math.round(distanceM)}m from venue
                                    {accuracyM != null ? ` · ±${Math.round(accuracyM)}m GPS accuracy` : ''}
                                </>
                            ) : (
                                'GPS not captured'
                            )}
                        </p>
                    </div>
                </div>

                {isFar && (
                    <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800">
                            Check-in logged more than {WARN_DISTANCE_M}m from the venue.
                            Review the evidence photo below.
                        </p>
                    </div>
                )}

                {evidencePath && evidenceSignedUrl && (
                    <div className="mt-3">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--foreground-muted)] mb-2">
                            Evidence photo
                        </p>
                        <a
                            href={evidenceSignedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden border border-[var(--border-color)]"
                        >
                            <Image
                                src={evidenceSignedUrl}
                                alt="Check-in evidence photo"
                                width={600}
                                height={400}
                                className="w-full h-auto"
                                unoptimized
                            />
                        </a>
                    </div>
                )}

                {/* Ref can re-upload if they need a clearer photo (still inside
                    the window). Window-gated to prevent post-hoc tampering. */}
                {isReferee && inWindow && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                        <p className="text-xs text-[var(--foreground-muted)] mb-2">
                            Need to re-upload your evidence photo?
                        </p>
                        {pendingPreview ? (
                            <div className="space-y-2">
                                <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)]">
                                    <Image
                                        src={pendingPreview}
                                        alt="Pending evidence photo"
                                        width={600}
                                        height={400}
                                        className="w-full h-auto"
                                        unoptimized
                                    />
                                    <button
                                        type="button"
                                        onClick={clearPendingFile}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
                                        aria-label="Remove photo"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <SafeguardingNotice
                                    acknowledged={acknowledgedSafeguarding}
                                    onChange={setAcknowledgedSafeguarding}
                                />
                                <Button
                                    fullWidth
                                    variant="primary"
                                    onClick={handleCheckIn}
                                    loading={submitting}
                                    disabled={!acknowledgedSafeguarding}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Replace evidence photo
                                </Button>
                            </div>
                        ) : (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFilePick}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-[var(--border-color)] text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--neutral-50)] flex items-center justify-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Add a new photo
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // ── Ref: pre-checkin action card ──────────────────────────────────
    return (
        <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--foreground-muted)]">CHECK IN AT THE VENUE</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                    Action required
                </span>
            </div>

            <p className="text-sm text-[var(--foreground)] mb-1">
                You&apos;re at <span className="font-semibold">{venueLabel}</span>?
            </p>
            <p className="text-xs text-[var(--foreground-muted)] mb-4">
                Tapping check-in logs your location and notifies the coach you&apos;ve
                arrived. A photo is optional but recommended for your evidence trail.
            </p>

            {/* Optional photo */}
            {pendingPreview ? (
                <div className="mb-3 space-y-2">
                    <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)]">
                        <Image
                            src={pendingPreview}
                            alt="Pending evidence photo"
                            width={600}
                            height={400}
                            className="w-full h-auto"
                            unoptimized
                        />
                        <button
                            type="button"
                            onClick={clearPendingFile}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
                            aria-label="Remove photo"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFilePick}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full mb-3 py-3 rounded-xl border border-dashed border-[var(--border-color)] text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--neutral-50)] flex items-center justify-center gap-2"
                    >
                        <Camera className="w-4 h-4" />
                        Add evidence photo (optional)
                    </button>
                </>
            )}

            {/* Safeguarding warning — REQUIRED before checking in if a photo
                is attached. Plain checkbox so it's visible and accessible. */}
            {pendingFile && (
                <SafeguardingNotice
                    acknowledged={acknowledgedSafeguarding}
                    onChange={setAcknowledgedSafeguarding}
                />
            )}

            <Button
                fullWidth
                variant="primary"
                onClick={handleCheckIn}
                loading={submitting}
                disabled={!!pendingFile && !acknowledgedSafeguarding}
            >
                <MapPin className="w-4 h-4 mr-2" />
                Check in now
            </Button>
        </div>
    )
}

function SafeguardingNotice({
    acknowledged,
    onChange,
}: {
    acknowledged: boolean
    onChange: (v: boolean) => void
}) {
    return (
        <label className="flex items-start gap-2 p-3 my-2 rounded-lg bg-red-50 border border-red-200 cursor-pointer">
            <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 flex-shrink-0 accent-red-600"
            />
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-800 leading-relaxed">
                    <span className="font-bold">Safeguarding:</span> do not include any
                    under-18 players in your photo. A pitch, goal, dugout, or empty stand
                    is fine — children must not be identifiable.
                </p>
            </div>
        </label>
    )
}
