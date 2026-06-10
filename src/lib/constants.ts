export const UK_COUNTIES = [
    'Aberdeenshire', 'Angus', 'Antrim', 'Argyll', 'Armagh', 'Ayrshire', 'Banffshire', 'Bedfordshire',
    'Berkshire', 'Berwickshire', 'Buckinghamshire', 'Buteshire', 'Caithness', 'Cambridgeshire',
    'Cardiganshire', 'Carmarthenshire', 'Cheshire', 'Clackmannanshire', 'Cornwall', 'Cromartyshire',
    'Cumberland', 'Denbighshire', 'Derbyshire', 'Devon', 'Dorset', 'Down', 'Dumfriesshire',
    'Dunbartonshire', 'Durham', 'East Lothian', 'Essex', 'Fermanagh', 'Fife', 'Flintshire',
    'Glamorgan', 'Gloucestershire', 'Hampshire', 'Herefordshire', 'Hertfordshire', 'Huntingdonshire',
    'Inverness-shire', 'Kent', 'Kincardineshire', 'Kinross-shire', 'Kirkcudbrightshire', 'Lanarkshire',
    'Lancashire', 'Leicestershire', 'Lincolnshire', 'London', 'Londonderry', 'Merionethshire',
    'Middlesex', 'Midlothian', 'Monmouthshire', 'Montgomeryshire', 'Morayshire', 'Nairnshire',
    'Norfolk', 'Northamptonshire', 'Northumberland', 'Nottinghamshire', 'Orkney', 'Oxfordshire',
    'Peeblesshire', 'Pembrokeshire', 'Perthshire', 'Radnorshire', 'Renfrewshire', 'Ross-shire',
    'Roxburghshire', 'Rutland', 'Selkirkshire', 'Shetland', 'Shropshire', 'Somerset', 'Staffordshire',
    'Stirlingshire', 'Suffolk', 'Surrey', 'Sussex', 'Sutherland', 'Tyrone', 'Warwickshire',
    'West Lothian', 'Westmorland', 'Wigtownshire', 'Wiltshire', 'Worcestershire', 'Yorkshire'
].sort()

export const MATCH_FORMATS = [
    { value: '5v5', label: '5-a-side' },
    { value: '7v7', label: '7-a-side' },
    { value: '8v8', label: '8-a-side' },
    { value: '9v9', label: '9-a-side' },
    { value: '11v11', label: '11-a-side' },
]

export const COMPETITION_TYPES = [
    { value: 'league', label: 'League Match' },
    { value: 'cup', label: 'Cup Match' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'other', label: 'Other' },
]

export const AGE_GROUPS = [
    { value: 'u7', label: 'Under 7s' },
    { value: 'u8', label: 'Under 8s' },
    { value: 'u9', label: 'Under 9s' },
    { value: 'u10', label: 'Under 10s' },
    { value: 'u11', label: 'Under 11s' },
    { value: 'u12', label: 'Under 12s' },
    { value: 'u13', label: 'Under 13s' },
    { value: 'u14', label: 'Under 14s' },
    { value: 'u15', label: 'Under 15s' },
    { value: 'u16', label: 'Under 16s' },
    { value: 'u17', label: 'Under 17s' },
    { value: 'u18', label: 'Under 18s' },
    { value: 'adult', label: 'Adult' },
    { value: 'veterans', label: 'Veterans' },
]

/** Age groups where a verified DBS check is mandatory for the referee (U16 and under). */
export const DBS_REQUIRED_AGE_GROUPS = new Set([
    'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16',
])

/** Returns true if the given age group requires a DBS-verified referee. */
export function requiresDBS(ageGroup: string | null | undefined): boolean {
    return !!ageGroup && DBS_REQUIRED_AGE_GROUPS.has(ageGroup)
}

/** Minimum age a referee can be (FA safeguarding). Under-14s cannot register. */
export const MINIMUM_REFEREE_AGE = 14

/** Age below which a referee requires parental consent + has in-app messaging
 *  blocked. Policy (Terms §2/§5, Privacy §5): referees under 18 (ages 14–17)
 *  need verified parent/guardian consent before the account can be used, and
 *  have in-app messaging disabled. Minimum registration age stays 14. */
export const PARENTAL_CONSENT_AGE = 18

/**
 * Whole-years age on a given date. Both args accept a Date or an
 * ISO date/datetime string. Returns 0 for an unparseable / future DOB.
 */
export function ageOnDate(
    dob: string | Date | null | undefined,
    onDate: string | Date = new Date(),
): number {
    if (!dob) return 0
    const birth = dob instanceof Date ? dob : new Date(dob)
    const on = onDate instanceof Date ? onDate : new Date(onDate)
    if (Number.isNaN(birth.getTime()) || Number.isNaN(on.getTime())) return 0
    let age = on.getFullYear() - birth.getFullYear()
    const m = on.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && on.getDate() < birth.getDate())) age--
    return age < 0 ? 0 : age
}

/**
 * Highest youth age-group NUMBER a referee of the given age may officiate.
 * 18+ → null (no cap — all groups incl. adult/veterans). 17→16, 16→15,
 * 15→14, 14→13. Below the minimum age → -1 (eligible for nothing).
 */
export function maxAgeGroupForRefereeAge(refAge: number): number | null {
    if (refAge < MINIMUM_REFEREE_AGE) return -1
    if (refAge >= 18) return null
    return refAge - 1
}

/**
 * Whether a referee of `refAge` may officiate `ageGroup` (an AGE_GROUPS
 * value such as 'u13' | 'adult' | 'veterans', or null/'' for an
 * unspecified/general game). Eligibility mapping:
 *   18+ = all · 17 = ≤U16 · 16 = ≤U15 · 15 = ≤U14 · 14 = ≤U13.
 * Adult/Veterans require age ≥ 18. A null/unknown age group is not a youth
 * game, so any valid-age referee (≥ MINIMUM_REFEREE_AGE) is eligible.
 */
export function refereeEligibleForAgeGroup(
    refAge: number,
    ageGroup: string | null | undefined,
): boolean {
    if (refAge < MINIMUM_REFEREE_AGE) return false
    if (refAge >= 18) return true
    if (!ageGroup) return true
    if (ageGroup === 'adult' || ageGroup === 'veterans') return refAge >= 18
    const match = /^u(\d{1,2})$/.exec(ageGroup)
    if (!match) return true
    const groupNumber = parseInt(match[1], 10)
    return groupNumber <= refAge - 1
}

/**
 * Whether a referee REQUIRES parental consent (and has in-app messaging
 * blocked). FAILS CLOSED: a null/unparseable DOB is treated as requiring
 * consent, so a referee with no DOB on file can never slip the under-18 gate.
 * Apply only to referees — coaches are not age-gated. Age computed at `onDate`
 * (default today, the reference point for the messaging block).
 */
export function requiresParentalConsent(
    dob: string | Date | null | undefined,
    onDate: string | Date = new Date(),
): boolean {
    if (!dob) return true
    const birth = dob instanceof Date ? dob : new Date(dob)
    if (Number.isNaN(birth.getTime())) return true
    return ageOnDate(dob, onDate) < PARENTAL_CONSENT_AGE
}

/**
 * Whether a referee is BLOCKED from officiating `ageGroup`. The fail-closed
 * inverse of refereeEligibleForAgeGroup: a null/unparseable DOB returns true
 * (blocked), so a referee with no DOB on file is never offered and can never
 * accept. Pass the MATCH DATE as `onDate` for booking eligibility.
 */
export function refereeBlockedFromAgeGroup(
    dob: string | Date | null | undefined,
    ageGroup: string | null | undefined,
    onDate: string | Date = new Date(),
): boolean {
    if (!dob) return true
    const birth = dob instanceof Date ? dob : new Date(dob)
    if (Number.isNaN(birth.getTime())) return true
    return !refereeEligibleForAgeGroup(ageOnDate(dob, onDate), ageGroup)
}

/** Platform booking fee added to coach's total per booking, in pence.
 *  Refunded to the coach (with the rest of the purse) if the booking is
 *  cancelled. Persisted source of truth is platform_settings.booking_fee_pence
 *  (migration 0164); this constant is the fallback when that row is absent. */
export const BOOKING_FEE_PENCE = 100

/**
 * Premium fee charged to the coach's wallet on SOS broadcast creation.
 * Non-refundable — even if no referee accepts. The point is to gate
 * casual / accidental SOS spam: SOS broadcasts page nearby refs urgently
 * so the cost-of-attention is real.
 */
export const SOS_FEE_PENCE = 199

/**
 * UK grassroots referee fee guide (2025/26 averages). Single source of truth
 * for the /app/price-guide page and the inline budget hint on the booking form.
 * `ageGroups` lists the AGE_GROUPS values each row covers; `min`/`max` are the
 * typical match-fee range in whole pounds (`max` is a soft floor for the "+"
 * tiers). These are guidance only — coaches set their own budget.
 */
export const REFEREE_FEE_GUIDE = [
    { label: 'U7–U8', ageGroups: ['u7', 'u8'], feeLabel: '£15–£20', min: 15, max: 20, format: '5v5' },
    { label: 'U9–U10', ageGroups: ['u9', 'u10'], feeLabel: '£20–£25', min: 20, max: 25, format: '7v7' },
    { label: 'U11–U12', ageGroups: ['u11', 'u12'], feeLabel: '£25–£30', min: 25, max: 30, format: '9v9' },
    { label: 'U13–U14', ageGroups: ['u13', 'u14'], feeLabel: '£30–£35', min: 30, max: 35, format: '11v11' },
    { label: 'U15–U16', ageGroups: ['u15', 'u16'], feeLabel: '£35–£40', min: 35, max: 40, format: '11v11' },
    { label: 'U17–U18', ageGroups: ['u17', 'u18'], feeLabel: '£40–£45', min: 40, max: 45, format: '11v11' },
    { label: 'Adult Grassroots', ageGroups: ['adult', 'veterans'], feeLabel: '£45–£60+', min: 45, max: 60, format: '11v11' },
] as const

/**
 * Suggested referee fee range for a booking age-group value (an AGE_GROUPS
 * `value` such as 'u13' | 'adult'). Returns null for an unknown/empty value.
 */
export function suggestedFeeForAgeGroup(
    ageGroup: string | null | undefined,
): (typeof REFEREE_FEE_GUIDE)[number] | null {
    if (!ageGroup) return null
    return (
        REFEREE_FEE_GUIDE.find((row) =>
            (row.ageGroups as readonly string[]).includes(ageGroup),
        ) ?? null
    )
}

/**
 * Double-booking window. Bookings store a kickoff but no end-time/duration,
 * so for clash detection a confirmed booking is assumed to occupy the
 * referee from kickoff for MATCH_DURATION_MINUTES plus a fixed travel buffer.
 * Two same-date bookings clash only when these windows overlap — so a referee
 * CAN officiate several non-overlapping matches on the same day.
 */
export const MATCH_DURATION_MINUTES = 120
export const MATCH_TRAVEL_BUFFER_MINUTES = 45
export const MATCH_BLOCK_MINUTES = MATCH_DURATION_MINUTES + MATCH_TRAVEL_BUFFER_MINUTES

/** Minutes since midnight for an 'HH:MM' or 'HH:MM:SS' time string. */
export function minutesSinceMidnight(time: string | null | undefined): number {
    if (!time) return 0
    const [h, m] = time.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

/**
 * True if two confirmed bookings clash for one referee: same calendar date
 * AND their [kickoff, kickoff + MATCH_BLOCK_MINUTES] windows intersect.
 * Different dates never clash (grassroots matches don't span midnight).
 */
export function bookingsClash(
    dateA: string | null | undefined,
    kickoffA: string | null | undefined,
    dateB: string | null | undefined,
    kickoffB: string | null | undefined,
): boolean {
    if (!dateA || !dateB || dateA !== dateB) return false
    const startA = minutesSinceMidnight(kickoffA)
    const startB = minutesSinceMidnight(kickoffB)
    return startA < startB + MATCH_BLOCK_MINUTES && startB < startA + MATCH_BLOCK_MINUTES
}
