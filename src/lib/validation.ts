import { z } from 'zod'

// ── Shared patterns ──────────────────────────────────────────────────────

/** UK postcode regex — covers all standard formats (e.g. SW1A 1AA, M1 1AA, B33 8TH) */
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

/** UUID v4 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** HH:MM time format */
const TIME_FORMAT = /^\d{2}:\d{2}$/

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
    format: z.enum(['5v5', '7v7', '9v9', '11v11']).optional().or(z.literal('')),
    competition_type: z.enum(['league', 'cup', 'friendly', 'tournament', 'other']).optional().or(z.literal('')),
    referee_level_required: z.string().max(50).optional().or(z.literal('')),
    home_team: z.string().max(100, 'Team name is too long').optional().or(z.literal('')),
    away_team: z.string().max(100, 'Team name is too long').optional().or(z.literal('')),
    address_text: z.string().max(300, 'Address is too long').optional().or(z.literal('')),
    notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
    budget_pounds: z.number().positive('Budget must be positive').max(500, 'Budget cannot exceed £500').optional(),
    booking_type: z.enum(['individual', 'central']).optional(),
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
