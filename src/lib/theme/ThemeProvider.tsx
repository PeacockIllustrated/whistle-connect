'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Check } from 'lucide-react'

// ============================================
// THEME CONFIGURATION
// ============================================

// Color themes
export const colorThemes = [
    { id: 'emerald', name: 'Emerald', color: '#10B981' },
    { id: 'midnight', name: 'Midnight', color: '#1E293B' },
    { id: 'electric', name: 'Electric', color: '#6366F1' },
    { id: 'sunset', name: 'Sunset', color: '#F97316' },
    { id: 'forest', name: 'Forest', color: '#22C55E' },
    { id: 'crimson', name: 'Crimson', color: '#DC2626' },
    { id: 'ocean', name: 'Ocean', color: '#0EA5E9' },
] as const

// Typography styles
export const typographyStyles = [
    { id: 'default', name: 'Modern', description: 'Clean & readable' },
    { id: 'sharp', name: 'Sharp', description: 'Bold & all-caps headers' },
    { id: 'elegant', name: 'Elegant', description: 'Refined & sophisticated' },
] as const

// Radius/Feel styles
export const radiusStyles = [
    { id: 'rounded', name: 'Rounded', description: 'Soft corners', preview: '16px' },
    { id: 'sharp', name: 'Sharp', description: 'Modern edges', preview: '4px' },
    { id: 'extra-sharp', name: 'Extra Sharp', description: 'Zero radius', preview: '0px' },
] as const

export type ColorThemeId = typeof colorThemes[number]['id']
export type TypographyStyleId = typeof typographyStyles[number]['id']
export type RadiusStyleId = typeof radiusStyles[number]['id']

interface ThemeSettings {
    color: ColorThemeId
    typography: TypographyStyleId
    radius: RadiusStyleId
}

const THEME_STORAGE_KEY = 'whistle-connect-theme-settings'

const defaultSettings: ThemeSettings = {
    color: 'emerald',
    typography: 'default',
    radius: 'rounded',
}

// ============================================
// CONTEXT
// ============================================

interface ThemeContextValue {
    settings: ThemeSettings
    setColorTheme: (color: ColorThemeId) => void
    setTypography: (typography: TypographyStyleId) => void
    setRadius: (radius: RadiusStyleId) => void
    resetToDefaults: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

// ============================================
// THEME PROVIDER
// ============================================

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<ThemeSettings>(defaultSettings)
    const [mounted, setMounted] = useState(false)

    const applySettings = (s: ThemeSettings) => {
        const root = document.documentElement

        // Apply color theme
        root.setAttribute('data-color', s.color)

        // Apply typography
        root.setAttribute('data-typography', s.typography)

        // Apply radius
        root.setAttribute('data-radius', s.radius)
    }

    // Load settings from localStorage on mount
    useEffect(() => {
        setMounted(true) // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: standard hydration pattern for client-side storage
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved) as Partial<ThemeSettings>
                const loaded: ThemeSettings = {
                    color: parsed.color || defaultSettings.color,
                    typography: parsed.typography || defaultSettings.typography,
                    radius: parsed.radius || defaultSettings.radius,
                }
                setSettings(loaded)
                applySettings(loaded)
            }
        } catch (e) {
            console.error('Failed to load theme settings:', e)
        }
    }, [])


    const saveAndApply = useCallback((newSettings: ThemeSettings) => {
        setSettings(newSettings)
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newSettings))
        applySettings(newSettings)
    }, [])

    const setColorTheme = useCallback((color: ColorThemeId) => {
        saveAndApply({ ...settings, color })
    }, [settings, saveAndApply])

    const setTypography = useCallback((typography: TypographyStyleId) => {
        saveAndApply({ ...settings, typography })
    }, [settings, saveAndApply])

    const setRadius = useCallback((radius: RadiusStyleId) => {
        saveAndApply({ ...settings, radius })
    }, [settings, saveAndApply])

    const resetToDefaults = useCallback(() => {
        saveAndApply(defaultSettings)
    }, [saveAndApply])

    if (!mounted) return null

    return (
        <ThemeContext.Provider value={{ settings, setColorTheme, setTypography, setRadius, resetToDefaults }}>
            {children}
        </ThemeContext.Provider>
    )
}

// ============================================
// THEME PICKER COMPONENTS
// ============================================

export function ColorPicker() {
    const { settings, setColorTheme } = useTheme()

    return (
        <div className="flex flex-wrap gap-2">
            {colorThemes.map((theme) => (
                <button
                    key={theme.id}
                    onClick={() => setColorTheme(theme.id)}
                    className={`
                        w-12 h-12 rounded-xl transition-all flex items-center justify-center
                        ${settings.color === theme.id
                            ? 'ring-2 ring-offset-2 ring-[var(--color-primary)] scale-110'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'}
                    `}
                    style={{ background: theme.color }}
                    title={theme.name}
                >
                    {settings.color === theme.id && (
                        <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                    )}
                </button>
            ))}
        </div>
    )
}

export function TypographyPicker() {
    const { settings, setTypography } = useTheme()

    return (
        <div className="grid grid-cols-3 gap-2">
            {typographyStyles.map((style) => (
                <button
                    key={style.id}
                    onClick={() => setTypography(style.id)}
                    className={`
                        p-3 rounded-xl border-2 transition-all text-center
                        ${settings.typography === style.id
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                            : 'border-[var(--border-color)] hover:border-[var(--neutral-300)]'}
                    `}
                >
                    <div className={`text-lg font-bold mb-1 ${style.id === 'sharp' ? 'uppercase tracking-wider' : ''} ${style.id === 'elegant' ? 'italic' : ''}`}>
                        Aa
                    </div>
                    <p className="text-xs font-semibold">{style.name}</p>
                    <p className="text-[10px] text-[var(--foreground-muted)]">{style.description}</p>
                </button>
            ))}
        </div>
    )
}

export function RadiusPicker() {
    const { settings, setRadius } = useTheme()

    return (
        <div className="grid grid-cols-3 gap-2">
            {radiusStyles.map((style) => (
                <button
                    key={style.id}
                    onClick={() => setRadius(style.id)}
                    className={`
                        p-3 border-2 transition-all text-center
                        ${settings.radius === style.id
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                            : 'border-[var(--border-color)] hover:border-[var(--neutral-300)]'}
                    `}
                    style={{ borderRadius: style.preview }}
                >
                    <div
                        className="w-10 h-10 mx-auto mb-2 bg-[var(--color-primary)]"
                        style={{ borderRadius: style.preview }}
                    />
                    <p className="text-xs font-semibold">{style.name}</p>
                    <p className="text-[10px] text-[var(--foreground-muted)]">{style.description}</p>
                </button>
            ))}
        </div>
    )
}

// Full theme picker with all options
export function ThemePicker() {
    const { resetToDefaults } = useTheme()

    return (
        <div className="space-y-6">
            {/* Colors */}
            <div>
                <h3 className="text-sm font-semibold mb-3">Color</h3>
                <ColorPicker />
            </div>

            {/* Typography */}
            <div>
                <h3 className="text-sm font-semibold mb-3">Typography</h3>
                <TypographyPicker />
            </div>

            {/* Radius */}
            <div>
                <h3 className="text-sm font-semibold mb-3">Shape</h3>
                <RadiusPicker />
            </div>

            {/* Reset */}
            <button
                onClick={resetToDefaults}
                className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline"
            >
                Reset to defaults
            </button>
        </div>
    )
}

// Quick theme toggle for header (cycles through colors)
export function ThemeToggle() {
    const { settings, setColorTheme } = useTheme()
    const currentIndex = colorThemes.findIndex(t => t.id === settings.color)

    const nextTheme = () => {
        const nextIndex = (currentIndex + 1) % colorThemes.length
        setColorTheme(colorThemes[nextIndex].id)
    }

    return (
        <button
            onClick={nextTheme}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            title={`Theme: ${colorThemes[currentIndex]?.name || 'Emerald'}`}
        >
            <div
                className="w-5 h-5 rounded-md transition-colors"
                style={{ background: colorThemes[currentIndex]?.color || '#10B981' }}
            />
        </button>
    )
}
