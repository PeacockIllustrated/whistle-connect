'use client'

import { ThemePicker } from '@/lib/theme/ThemeProvider'

export function ThemePickerSection() {
    return (
        <div>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
                Customize the look and feel of the app. Your preferences are saved automatically.
            </p>
            <ThemePicker />
        </div>
    )
}
