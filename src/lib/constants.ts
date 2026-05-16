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

/** Age below which a referee requires parental consent + has in-app messaging blocked. */
export const PARENTAL_CONSENT_AGE = 16

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

/** Platform booking fee added to coach's total per booking, in pence. */
export const BOOKING_FEE_PENCE = 99

/**
 * Premium fee charged to the coach's wallet on SOS broadcast creation.
 * Non-refundable — even if no referee accepts. The point is to gate
 * casual / accidental SOS spam: SOS broadcasts page nearby refs urgently
 * so the cost-of-attention is real.
 */
export const SOS_FEE_PENCE = 199

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
