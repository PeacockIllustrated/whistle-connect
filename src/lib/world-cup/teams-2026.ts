// ============================================================================
// 2026 FIFA World Cup — the 48 qualified teams and their group draw.
//
// Canonical, baked-in list so the tracker + sweepstake draw work immediately
// with zero external dependency. Group composition confirmed 2026-06-11 (Al
// Jazeera / FIFA). Live scores + knockout progression are layered on top by the
// results cron (src/app/api/cron/wc-sync). country_code is derived from the FIFA
// code via isoForFifa() at seed time.
// ============================================================================

export interface SeedTeam {
    code: string
    name: string
    group: string
}

export const WC_2026_TEAMS: SeedTeam[] = [
    // Group A
    { code: 'MEX', name: 'Mexico', group: 'A' },
    { code: 'RSA', name: 'South Africa', group: 'A' },
    { code: 'KOR', name: 'South Korea', group: 'A' },
    { code: 'CZE', name: 'Czechia', group: 'A' },
    // Group B
    { code: 'CAN', name: 'Canada', group: 'B' },
    { code: 'BIH', name: 'Bosnia & Herzegovina', group: 'B' },
    { code: 'QAT', name: 'Qatar', group: 'B' },
    { code: 'SUI', name: 'Switzerland', group: 'B' },
    // Group C
    { code: 'BRA', name: 'Brazil', group: 'C' },
    { code: 'MAR', name: 'Morocco', group: 'C' },
    { code: 'HAI', name: 'Haiti', group: 'C' },
    { code: 'SCO', name: 'Scotland', group: 'C' },
    // Group D
    { code: 'USA', name: 'USA', group: 'D' },
    { code: 'PAR', name: 'Paraguay', group: 'D' },
    { code: 'AUS', name: 'Australia', group: 'D' },
    { code: 'TUR', name: 'Türkiye', group: 'D' },
    // Group E
    { code: 'GER', name: 'Germany', group: 'E' },
    { code: 'CUW', name: 'Curaçao', group: 'E' },
    { code: 'CIV', name: 'Côte d\'Ivoire', group: 'E' },
    { code: 'ECU', name: 'Ecuador', group: 'E' },
    // Group F
    { code: 'NED', name: 'Netherlands', group: 'F' },
    { code: 'JPN', name: 'Japan', group: 'F' },
    { code: 'SWE', name: 'Sweden', group: 'F' },
    { code: 'TUN', name: 'Tunisia', group: 'F' },
    // Group G
    { code: 'BEL', name: 'Belgium', group: 'G' },
    { code: 'EGY', name: 'Egypt', group: 'G' },
    { code: 'IRN', name: 'Iran', group: 'G' },
    { code: 'NZL', name: 'New Zealand', group: 'G' },
    // Group H
    { code: 'ESP', name: 'Spain', group: 'H' },
    { code: 'CPV', name: 'Cape Verde', group: 'H' },
    { code: 'KSA', name: 'Saudi Arabia', group: 'H' },
    { code: 'URU', name: 'Uruguay', group: 'H' },
    // Group I
    { code: 'FRA', name: 'France', group: 'I' },
    { code: 'SEN', name: 'Senegal', group: 'I' },
    { code: 'IRQ', name: 'Iraq', group: 'I' },
    { code: 'NOR', name: 'Norway', group: 'I' },
    // Group J
    { code: 'ARG', name: 'Argentina', group: 'J' },
    { code: 'ALG', name: 'Algeria', group: 'J' },
    { code: 'AUT', name: 'Austria', group: 'J' },
    { code: 'JOR', name: 'Jordan', group: 'J' },
    // Group K
    { code: 'POR', name: 'Portugal', group: 'K' },
    { code: 'COD', name: 'DR Congo', group: 'K' },
    { code: 'UZB', name: 'Uzbekistan', group: 'K' },
    { code: 'COL', name: 'Colombia', group: 'K' },
    // Group L
    { code: 'ENG', name: 'England', group: 'L' },
    { code: 'CRO', name: 'Croatia', group: 'L' },
    { code: 'GHA', name: 'Ghana', group: 'L' },
    { code: 'PAN', name: 'Panama', group: 'L' },
]

/**
 * Resolve a free-text team name (e.g. from the openfootball feed) to our FIFA
 * code. Includes the common name variants the feed may use. Returns null when
 * unrecognised so the caller can skip rather than mis-attribute.
 */
const NAME_TO_CODE: Record<string, string> = (() => {
    const map: Record<string, string> = {}
    for (const t of WC_2026_TEAMS) map[normalise(t.name)] = t.code
    const aliases: Record<string, string> = {
        'korea republic': 'KOR', 'republic of korea': 'KOR', 'south korea': 'KOR',
        'united states': 'USA', 'united states of america': 'USA', 'usmnt': 'USA',
        'turkiye': 'TUR', 'turkey': 'TUR',
        'czech republic': 'CZE', 'czechia': 'CZE',
        'ivory coast': 'CIV', 'cote divoire': 'CIV', "cote d'ivoire": 'CIV',
        'curacao': 'CUW',
        'cape verde islands': 'CPV', 'cabo verde': 'CPV',
        'bosnia and herzegovina': 'BIH', 'bosnia herzegovina': 'BIH', 'bosnia': 'BIH',
        'dr congo': 'COD', 'congo dr': 'COD', 'democratic republic of the congo': 'COD',
        'iran': 'IRN', 'ir iran': 'IRN',
    }
    for (const [name, code] of Object.entries(aliases)) map[normalise(name)] = code
    return map
})()

function normalise(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

export function codeForName(name: string): string | null {
    return NAME_TO_CODE[normalise(name)] ?? null
}
