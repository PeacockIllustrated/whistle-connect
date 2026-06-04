import { z } from 'zod'
import { ageOnDate, MINIMUM_REFEREE_AGE, PARENTAL_CONSENT_AGE } from '@/lib/constants'

// ── Shared patterns ──────────────────────────────────────────────────────

/** UK postcode regex — covers all standard formats (e.g. SW1A 1AA, M1 1AA, B33 8TH) */
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

/** UUID v4 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** HH:MM or HH:MM:SS time format (Postgres time type returns seconds) */
const TIME_FORMAT = /^\d{2}:\d{2}(:\d{2})?$/

/** Ensures a date string is in the future (today or later) */
function isFutureDate(dateStr: string): boolean {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date >= today
}

// ── Auth schemas ─────────────────────────────────────────────────────────

export const signInSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})

export const resetPasswordRequestSchema = z.object({
    email: z.string().email('Invalid email address'),
})

export const updatePasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signUpSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
    role: z.enum(['coach', 'referee', 'admin'], { message: 'Invalid role' }),
    phone: z.string().max(20, 'Phone number is too long').optional().or(z.literal('')),
    postcode: z.string().regex(UK_POSTCODE, 'Invalid UK postcode').optional().or(z.literal('')),
    fa_number: z.string()
        .regex(/^\d{8,10}$/, 'FA number must be 8-10 digits')
        .optional()
        .or(z.literal('')),
    date_of_birth: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
        .optional()
        .or(z.literal('')),
    parent_email: z.string()
        .email('Invalid parent/guardian email address')
        .optional()
        .or(z.literal('')),
    // Both must be exactly true. z.literal(true) rejects false / undefined / "true" string.
    terms_accepted: z.literal(true, {
        message: 'You must accept the Terms of Service to create an account',
    }),
    privacy_accepted: z.literal(true, {
        message: 'You must accept the Privacy Policy and FA safeguarding consent to create an account',
    }),
}).superRefine((data, ctx) => {
    // Age / parental-consent rules apply to referees only.
    if (data.role !== 'referee') return

    if (!data.date_of_birth) {
        ctx.addIssue({
            code: 'custom',
            path: ['date_of_birth'],
            message: 'Date of birth is required for referees',
        })
        return
    }

    const age = ageOnDate(data.date_of_birth)
    if (age < MINIMUM_REFEREE_AGE) {
        ctx.addIssue({
            code: 'custom',
            path: ['date_of_birth'],
            message: `Referees must be at least ${MINIMUM_REFEREE_AGE} years old`,
        })
        return
    }

    if (age < PARENTAL_CONSENT_AGE && !data.parent_email) {
        ctx.addIssue({
            code: 'custom',
            path: ['parent_email'],
            message: "A parent or guardian's email is required for referees under 16",
        })
    }
})

// ── Booking schemas ──────────────────────────────────────────────────────

export const bookingSchema = z.object({
    match_date: z.string()
        .min(1, 'Match date is required')
        .refine(isFutureDate, 'Match date must be today or in the future'),
    kickoff_time: z.string()
        .regex(TIME_FORMAT, 'Invalid time format (HH:MM)'),
    location_postcode: z.string()
        .regex(UK_POSTCODE, 'Invalid UK postcode'),
    county: z.string().max(100).optional().or(z.literal('')),
    ground_name: z.string().max(200, 'Ground name is too long').optional().or(z.literal('')),
    age_group: z.string().max(50).optional().or(z.literal('')),
    format: z.enum(['5v5', '7v7', '8v8', '9v9', '11v11']).optional().or(z.literal('')),
    competition_type: z.enum(['league', 'cup', 'friendly', 'tournament', 'other']).optional().or(z.literal('')),
    referee_level_required: z.string().max(50).optional().or(z.literal('')),
    home_team: z.string().max(100, 'Team name is too long').optional().or(z.literal('')),
    away_team: z.string().max(100, 'Team name is too long').optional().or(z.literal('')),
    address_text: z.string().max(300, 'Address is too long').optional().or(z.literal('')),
    notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
    budget_pounds: z.number().positive('Budget must be positive').max(500, 'Budget cannot exceed £500').optional(),
    booking_type: z.enum(['individual', 'central', 'tournament']).optional(),
    tournament_name: z.string().max(200, 'Tournament name is too long').optional().or(z.literal('')),
    matches: z.array(z.object({
        kickoff_time: z.string().regex(TIME_FORMAT, 'Invalid kick-off time (HH:MM)'),
        home_team: z.string().max(100, 'Team name is too long').optional().or(z.literal('')),
        away_team: z.string().max(100, 'Team name is too long').optional().or(z.literal('')),
    })).max(50, 'Too many matches').optional(),
}).superRefine((data, ctx) => {
    const isMulti = data.booking_type === 'tournament' || data.booking_type === 'central'
    if (!isMulti) return

    if (!data.matches || data.matches.length < 1) {
        ctx.addIssue({
            code: 'custom',
            path: ['matches'],
            message: 'Add at least one match with a kick-off time',
        })
    }
    if (data.booking_type === 'tournament' && !data.tournament_name?.trim()) {
        ctx.addIssue({
            code: 'custom',
            path: ['tournament_name'],
            message: 'Tournament name is required',
        })
    }
    if (data.booking_type === 'central' && data.tournament_name?.trim()) {
        ctx.addIssue({
            code: 'custom',
            path: ['tournament_name'],
            message: 'Central venue bookings do not have a tournament name',
        })
    }
})

export const confirmPriceSchema = z.object({
    offerId: z.string().regex(UUID, 'Invalid offer ID'),
})

export const acceptOfferSchema = z.object({
    offerId: z.string().regex(UUID, 'Invalid offer ID'),
    pricePounds: z.number()
        .positive('Price must be positive')
        .max(500, 'Price cannot exceed £500'),
})

export const offerPriceSchema = z.object({
    pricePounds: z.number()
        .positive('Price must be positive')
        .max(500, 'Price cannot exceed £500'),
})

// ── Message schemas ──────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
    threadId: z.string().regex(UUID, 'Invalid thread ID'),
    body: z.string()
        .min(1, 'Message cannot be empty')
        .max(5000, 'Message is too long (max 5000 characters)'),
})

// ── Availability schemas ─────────────────────────────────────────────────

const timeSlotSchema = z.object({
    start_time: z.string().regex(TIME_FORMAT, 'Invalid start time (HH:MM)'),
    end_time: z.string().regex(TIME_FORMAT, 'Invalid end time (HH:MM)'),
}).refine(
    slot => slot.start_time < slot.end_time,
    { message: 'End time must be after start time' }
)

export const updateAvailabilitySchema = z.object({
    date: z.string().min(1, 'Date is required'),
    slots: z.array(timeSlotSchema).max(10, 'Maximum 10 time slots per day'),
})

// ── Helper: parse and return first error ─────────────────────────────────

/**
 * Validates data against a Zod schema.
 * Returns `null` if valid, or the first error message string if invalid.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): string | null {
    const result = schema.safeParse(data)
    if (result.success) return null
    return result.error.issues[0]?.message || 'Invalid input'
}

export const topUpSchema = z.object({
    amountPounds: z.number().min(5, 'Minimum top-up is £5').max(500, 'Maximum top-up is £500'),
})

export const withdrawSchema = z.object({
    amountPounds: z.number().min(5, 'Minimum withdrawal is £5').max(10000, 'Maximum withdrawal is £10,000'),
})

export const DISPUTE_CATEGORIES = [
    'match_did_not_happen',
    'referee_no_show',
    'coach_no_show',
    'fee_dispute',
    'conduct_issue',
    'service_quality',
    'safety_concern',
    'other',
] as const

export const DISPUTE_DESIRED_OUTCOMES = [
    'refund_full',
    'refund_partial',
    'release_full',
    'mediation',
] as const

export const disputeSchema = z.object({
    bookingId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid booking ID'),
    category: z.enum(DISPUTE_CATEGORIES, { message: 'Pick a category that best describes the issue' }),
    reason: z.string()
        .min(50, 'Please describe the issue in at least 50 characters so an admin can investigate properly')
        .max(2000, 'Please keep the description under 2000 characters'),
    desiredOutcome: z.enum(DISPUTE_DESIRED_OUTCOMES, { message: 'Tell us what outcome you\'re seeking' }),
    incidentAt: z.string().datetime({ offset: true }).optional().or(z.literal('')),
})

export type DisputeCategory = typeof DISPUTE_CATEGORIES[number]
export type DisputeDesiredOutcome = typeof DISPUTE_DESIRED_OUTCOMES[number]

// ── Moderation schemas (Apple Guideline 1.2: report / block) ──────────────

export const REPORT_CATEGORIES = [
    'spam',
    'harassment',
    'hate_or_abuse',
    'inappropriate',
    'safety_concern',
    'other',
] as const

export const reportSchema = z.object({
    category: z.enum(REPORT_CATEGORIES, { message: 'Pick a category that best describes the issue' }),
    reason: z.string()
        .min(10, 'Please describe the issue in at least 10 characters')
        .max(2000, 'Please keep the description under 2000 characters'),
    messageId: z.string().regex(UUID, 'Invalid message ID').optional(),
    reportedUserId: z.string().regex(UUID, 'Invalid user ID').optional(),
    threadId: z.string().regex(UUID, 'Invalid thread ID').optional(),
}).refine(
    (data) => Boolean(data.messageId || data.reportedUserId || data.threadId),
    { message: 'A report must reference a message, user, or thread' }
)

export const blockSchema = z.object({
    blockedId: z.string().regex(UUID, 'Invalid user ID'),
})

export type ReportCategory = typeof REPORT_CATEGORIES[number]
export type ReportInput = z.infer<typeof reportSchema>
export type BlockInput = z.infer<typeof blockSchema>
