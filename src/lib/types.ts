// ============================================
// WHISTLE CONNECT - TYPE DEFINITIONS
// ============================================

// User Roles
export type UserRole = 'coach' | 'referee' | 'admin'

// Booking Status Lifecycle
export type BookingStatus = 'draft' | 'pending' | 'offered' | 'confirmed' | 'completed' | 'cancelled'

// Offer Status
export type OfferStatus = 'sent' | 'accepted' | 'accepted_priced' | 'declined' | 'withdrawn' | 'expired'

// FA Verification Status
export type FAVerificationStatus = 'not_provided' | 'pending' | 'verified' | 'rejected'

// Match Formats
export type MatchFormat = '5v5' | '7v7' | '8v8' | '9v9' | '11v11'

// Competition Types
export type CompetitionType = 'league' | 'cup' | 'friendly' | 'tournament' | 'other'

// Message Types
export type MessageKind = 'user' | 'system'

// ============================================
// DATABASE MODELS
// ============================================

export interface Profile {
    id: string
    role: UserRole
    full_name: string
    phone: string | null
    postcode: string | null
    avatar_url: string | null
    club_name: string | null
    latitude: number | null
    longitude: number | null
    created_at: string
    updated_at: string
}

export interface Club {
    id: string
    owner_id: string
    name: string
    home_postcode: string
    ground_name: string | null
    latitude: number | null
    longitude: number | null
    created_at: string
    updated_at: string
}

export type DBSStatus = 'not_provided' | 'provided' | 'verified' | 'expired'

export interface RefereeProfile {
    profile_id: string
    fa_id: string | null
    fa_verification_status: FAVerificationStatus
    level: string | null
    travel_radius_km: number
    county: string | null
    verified: boolean
    central_venue_opt_in: boolean
    is_available: boolean
    dbs_status: DBSStatus
    dbs_expires_at: string | null
    safeguarding_status: DBSStatus
    safeguarding_expires_at: string | null
    reliability_score: number
    total_matches_completed: number
    average_rating: number
    created_at: string
    updated_at: string
}

export interface RefereeAvailability {
    id: string
    referee_id: string
    day_of_week: number // 0 = Sunday, 6 = Saturday
    start_time: string // HH:MM:SS format
    end_time: string
    created_at: string
}

export interface RefereeDateAvailability {
    id: string
    referee_id: string
    date: string // YYYY-MM-DD
    start_time: string // HH:MM:SS
    end_time: string
    created_at: string
}

export interface Booking {
    id: string
    coach_id: string
    club_id: string | null
    status: BookingStatus
    match_date: string // YYYY-MM-DD
    kickoff_time: string // HH:MM:SS
    location_postcode: string
    ground_name: string | null
    age_group: string | null
    format: MatchFormat | null
    competition_type: CompetitionType | null
    referee_level_required: string | null
    county: string | null
    home_team: string | null
    away_team: string | null
    address_text: string | null
    notes: string | null
    budget_pounds: number | null
    booking_type: 'individual' | 'central'
    latitude: number | null
    longitude: number | null
    is_sos: boolean
    sos_expires_at: string | null
    deleted_at: string | null
    escrow_amount_pence: number | null
    escrow_released_at: string | null
    created_at: string
    updated_at: string
}

export interface BookingOffer {
    id: string
    booking_id: string
    referee_id: string
    status: OfferStatus
    price_pence: number | null
    currency: string
    sent_at: string
    created_at: string
    responded_at: string | null
}

export interface BookingAssignment {
    id: string
    booking_id: string
    referee_id: string
    confirmed_at: string
    created_at: string
}

export interface Thread {
    id: string
    booking_id: string | null
    title: string | null
    created_at: string
    updated_at: string
}

export interface ThreadParticipant {
    thread_id: string
    profile_id: string
    created_at: string
    last_read_at: string | null
}

export interface Message {
    id: string
    thread_id: string
    sender_id: string | null
    kind: MessageKind
    body: string
    created_at: string
}

// ============================================
// EXTENDED TYPES (with relations)
// ============================================

export interface ProfileWithReferee extends Profile {
    referee_profile?: RefereeProfile
}

export interface BookingWithDetails extends Booking {
    coach?: Profile
    club?: Club
    assignment?: BookingAssignment & { referee?: Profile }
    offers?: (BookingOffer & { referee?: Profile })[]
    thread?: Thread
}

export interface ThreadWithDetails extends Thread {
    booking?: Booking
    participants?: (ThreadParticipant & { profile?: Profile })[]
    messages?: Message[]
    last_message?: Message
    unread_count?: number
}

export interface MessageWithSender extends Message {
    sender?: Profile
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface BookingFormData {
    match_date: string
    kickoff_time: string
    location_postcode: string
    county?: string
    ground_name?: string
    age_group?: string
    format?: MatchFormat
    competition_type?: CompetitionType
    referee_level_required?: string
    home_team?: string
    away_team?: string
    address_text?: string
    notes?: string
    budget_pounds?: number
    booking_type?: 'individual' | 'central'
}

export interface SearchCriteria {
    county: string
    match_date: string
    kickoff_time: string
    age_group: string
    format: MatchFormat
    competition_type: CompetitionType
}

export interface RefereeSearchResult {
    id: string
    full_name: string
    avatar_url: string | null
    level: string | null
    county: string | null
    travel_radius_km: number
    verified: boolean
    fa_verification_status: FAVerificationStatus
    dbs_status: DBSStatus
    reliability_score: number | null
    total_matches_completed: number | null
    average_rating: number | null
    match_score: number | null
}

export interface AvailabilitySlot {
    day_of_week: number
    start_time: string
    end_time: string
}

// Type for referee search query results from Supabase joins
export interface RefereeProfileWithAvailability {
    county: string | null
    level: string | null
    verified: boolean
    travel_radius_km: number
    fa_verification_status: FAVerificationStatus
    central_venue_opt_in?: boolean
    profile: {
        id: string
        full_name: string
        avatar_url: string | null
    } | {
        id: string
        full_name: string
        avatar_url: string | null
    }[]
    availability: RefereeDateAvailability[] | RefereeDateAvailability
}

export interface RegisterFormData {
    email: string
    password: string
    full_name: string
    role: UserRole
    phone?: string
    postcode?: string
    fa_number?: string
}

// ============================================
// UI TYPES
// ============================================

export interface NavItem {
    href: string
    label: string
    icon: React.ReactNode
    badge?: number
}

export interface ActionCardProps {
    icon: React.ReactNode
    title: string
    subtitle?: string
    href?: string
    onClick?: () => void
    disabled?: boolean
}

// ============================================
// FA VERIFICATION TYPES
// ============================================

export type FAVerificationRequestStatus = 'awaiting_fa_response' | 'confirmed' | 'rejected'

export interface FAVerificationRequest {
    id: string
    referee_id: string
    fa_id: string
    county: string
    status: FAVerificationRequestStatus
    response_token: string
    requested_by: string
    requested_at: string
    resolved_at: string | null
    resolved_by: string | null
    notes: string | null
    created_at: string
}

export interface CountyFAContact {
    id: string
    county_name: string
    email: string
}

// ============================================================================
// Wallet & Escrow Types
// ============================================================================

export type WalletTransactionType =
    | 'top_up'
    | 'escrow_hold'
    | 'escrow_release'
    | 'escrow_refund'
    | 'withdrawal'
    | 'platform_fee'
    | 'admin_credit'
    | 'admin_debit'

export type WalletTransactionDirection = 'credit' | 'debit'

export type DisputeStatus = 'open' | 'resolved_coach' | 'resolved_referee' | 'resolved_split'

export interface Wallet {
    id: string
    user_id: string
    balance_pence: number
    escrow_pence: number
    currency: string
    stripe_customer_id: string | null
    stripe_connect_id: string | null
    stripe_connect_onboarded: boolean
    created_at: string
    updated_at: string
}

export interface WalletTransaction {
    id: string
    wallet_id: string
    type: WalletTransactionType
    amount_pence: number
    direction: WalletTransactionDirection
    balance_after_pence: number
    reference_type: string | null
    reference_id: string | null
    stripe_session_id: string | null
    stripe_transfer_id: string | null
    description: string | null
    created_at: string
}

export interface Dispute {
    id: string
    booking_id: string
    raised_by: string
    reason: string
    status: DisputeStatus
    admin_notes: string | null
    admin_user_id: string | null
    resolved_at: string | null
    created_at: string
}
