// ============================================================================
// Flag rendering. We use flag IMAGES (flagcdn.com), never emoji — emoji flags
// don't render on Windows and the project bans emoji in the UI.
//
// country_code is stored on wc_teams (ISO 3166-1 alpha-2, lower-case; the UK
// home nations use flagcdn's gb-eng / gb-sct / gb-wls / gb-nir variants).
// ============================================================================

/** FIFA 3-letter code → flagcdn country code. Used by the seed to populate
 *  wc_teams.country_code. Covers the realistic 2026 qualifier pool; unmapped
 *  codes fall back to a neutral placeholder at render time. */
export const FIFA_TO_ISO: Record<string, string> = {
    // Hosts
    CAN: 'ca', MEX: 'mx', USA: 'us',
    // UEFA
    ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir',
    FRA: 'fr', ESP: 'es', GER: 'de', POR: 'pt', NED: 'nl', BEL: 'be',
    ITA: 'it', CRO: 'hr', SUI: 'ch', AUT: 'at', POL: 'pl', SRB: 'rs',
    DEN: 'dk', SWE: 'se', NOR: 'no', UKR: 'ua', CZE: 'cz', TUR: 'tr',
    HUN: 'hu', GRE: 'gr', ROU: 'ro', SVK: 'sk', SVN: 'si', IRL: 'ie',
    ISL: 'is', FIN: 'fi', ALB: 'al', BIH: 'ba', GEO: 'ge', NMK: 'mk',
    // CONMEBOL
    ARG: 'ar', BRA: 'br', URU: 'uy', COL: 'co', ECU: 'ec', PAR: 'py',
    CHI: 'cl', PER: 'pe', BOL: 'bo', VEN: 've',
    // CONCACAF
    CRC: 'cr', PAN: 'pa', HON: 'hn', JAM: 'jm', SLV: 'sv', HAI: 'ht',
    GUA: 'gt', TRI: 'tt', CUW: 'cw', SUR: 'sr',
    // AFC
    JPN: 'jp', KOR: 'kr', AUS: 'au', IRN: 'ir', KSA: 'sa', QAT: 'qa',
    IRQ: 'iq', UAE: 'ae', UZB: 'uz', JOR: 'jo', CHN: 'cn', OMA: 'om',
    BHR: 'bh', PRK: 'kp', IND: 'in',
    // CAF
    MAR: 'ma', SEN: 'sn', TUN: 'tn', ALG: 'dz', EGY: 'eg', NGA: 'ng',
    CMR: 'cm', GHA: 'gh', CIV: 'ci', MLI: 'ml', RSA: 'za', COD: 'cd',
    BFA: 'bf', CPV: 'cv', ANG: 'ao', GAB: 'ga', GUI: 'gn',
    // OFC
    NZL: 'nz', NCL: 'nc',
}

/** flagcdn image URL for a stored country_code. `w` is one of flagcdn's widths. */
export function flagUrl(countryCode: string | null | undefined, w: 20 | 40 | 80 | 160 = 40): string | null {
    if (!countryCode) return null
    return `https://flagcdn.com/w${w}/${countryCode}.png`
}

/** Map a FIFA code to its ISO/flagcdn code (null when unknown). */
export function isoForFifa(fifa: string): string | null {
    return FIFA_TO_ISO[fifa.toUpperCase()] ?? null
}
