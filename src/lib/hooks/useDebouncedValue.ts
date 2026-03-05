import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of the provided value.
 * Only updates after `delay` ms of no changes.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debounced
}
