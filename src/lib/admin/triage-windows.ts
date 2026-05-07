/**
 * Time-window helpers for admin triage pages.
 * Extracted into a utility so server components can call these without
 * tripping the react-hooks/purity rule on Date.now() inside a component body.
 */

export function getSevenDaysAgoDate(): string {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function getOneHourAgoIso(): string {
    return new Date(Date.now() - 60 * 60 * 1000).toISOString()
}

export function getTwentyFourHoursAgoIso(): string {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export function getThirtyDaysAheadDate(): string {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function getTodayDate(): string {
    return new Date().toISOString().slice(0, 10)
}
