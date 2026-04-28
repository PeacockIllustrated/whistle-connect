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

/** Platform booking fee added to coach's total per booking, in pence. */
export const BOOKING_FEE_PENCE = 99
