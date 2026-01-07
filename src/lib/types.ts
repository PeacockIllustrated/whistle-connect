// ============================================
// WHISTLE CONNECT - TYPE DEFINITIONS
// ============================================

// User Roles
export type UserRole = 'coach' | 'referee' | 'admin'

// Booking Status Lifecycle
export type BookingStatus = 'draft' | 'pending' | 'offered' | 'confirmed' | 'completed' | 'cancelled'

// Offer Status
export type OfferStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn'

// Compliance Status
export type ComplianceStatus = 'not_provided' | 'provided' | 'verified' | 'expired'

// Match Formats
export type MatchFormat = '5v5' | '7v7' | '9v9' | '11v11'

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
    created_at: string
    updated_at: string
}

export interface Club {
    id: string
    owner_id: string
    name: string
    home_postcode: string
    ground_name: string | null
    created_at: string
    updated_at: string
}

export interface RefereeProfile {
    profile_id: string
    fa_id: string | null
    level: string | null
    travel_radius_km: number
    county: string | null
    verified: boolean
    dbs_status: ComplianceStatus
    dbs_expires_at: string | null
    safeguarding_status: ComplianceStatus
    safeguarding_expires_at: string | null
    bio: string | null
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
    notes: string | null
    budget_pounds: number | null
    created_at: string
    updated_at: string
}

export interface BookingOffer {
    id: string
    booking_id: string
    referee_id: string
    status: OfferStatus
    created_at: string
    responded_at: string | null
}

export interface BookingAssignment {
    id: string
    booking_id: string
    referee_id: string
    assigned_at: string
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
    joined_at: string
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
    ground_name?: string
    age_group?: string
    format?: MatchFormat
    competition_type?: CompetitionType
    referee_level_required?: string
    notes?: string
    budget_pounds?: number
}

export interface AvailabilitySlot {
    day_of_week: number
    start_time: string
    end_time: string
}

export interface RegisterFormData {
    email: string
    password: string
    full_name: string
    role: UserRole
    phone?: string
    postcode?: string
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
