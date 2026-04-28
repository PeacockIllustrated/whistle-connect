'use client'

import { useEffect, useState } from 'react'
import { isNative } from '@/lib/platform'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'install_prompt_dismissed'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type Mode = 'hidden' | 'android' | 'ios'

/**
 * Decide initial mode synchronously at mount.
 * iOS Safari has no `beforeinstallprompt` event, so we surface the manual
 * "Add to Home Screen" instructions immediately if it's the user's browser.
 * Android / desktop Chromium browsers stay hidden until the event fires.
 */
function computeInitialMode(): Mode {
    if (typeof window === 'undefined') return 'hidden'
    if (isNative()) return 'hidden'

    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (isStandalone) return 'hidden'

    try {
        const dismissed = window.localStorage.getItem(DISMISS_KEY)
        if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL_MS) return 'hidden'
    } catch {
        // localStorage may be disabled — proceed
    }

    const ua = window.navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)
    if (isIOS && isSafari) return 'ios'

    return 'hidden'
}

export function InstallPrompt() {
    // Initial mode is computed once at mount — keeps the effect free of
    // synchronous setState (which violates react-hooks/set-state-in-effect).
    const [mode, setMode] = useState<Mode>(computeInitialMode)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

    useEffect(() => {
        // The iOS path is already decided by the lazy initializer.
        // We only need event listeners for the Android / desktop Chromium path.
        if (typeof window === 'undefined') return
        if (isNative()) return

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setMode('android')
        }
        const installedHandler = () => setMode('hidden')

        window.addEventListener('beforeinstallprompt', handler as EventListener)
        window.addEventListener('appinstalled', installedHandler)

        return () => {
            window.removeEventListener('beforeinstallprompt', handler as EventListener)
            window.removeEventListener('appinstalled', installedHandler)
        }
    }, [])

    function dismiss() {
        localStorage.setItem(DISMISS_KEY, Date.now().toString())
        setMode('hidden')
    }

    async function installAndroid() {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        setDeferredPrompt(null)
        if (outcome === 'accepted') {
            setMode('hidden')
        } else {
            dismiss()
        }
    }

    if (mode === 'hidden') return null

    return (
        <div className="fixed bottom-[calc(var(--bottom-nav-height,72px)+88px)] left-4 right-4 z-50 mx-auto max-w-[var(--content-max-width,480px)] animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="rounded-[var(--radius-lg,14px)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-4 shadow-[var(--shadow-xl)] border border-white/10">
                <div className="flex items-start gap-3">
                    {/* Install icon */}
                    <div className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                            <path d="M12 17V3" />
                            <path d="m6 11 6 6 6-6" />
                            <path d="M19 21H5" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Install Whistle Connect</p>
                        {mode === 'android' ? (
                            <>
                                <p className="text-xs text-white/70 mt-0.5">Add the app to your home screen for faster access and push notifications.</p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={installAndroid}
                                        className="bg-white text-[var(--brand-primary)] font-semibold text-sm px-4 py-2 rounded-[var(--radius-md,10px)] transition-all duration-200 hover:bg-white/90 hover:shadow-md active:scale-[0.97]"
                                    >
                                        Install
                                    </button>
                                    <button
                                        onClick={dismiss}
                                        className="text-sm text-white/60 hover:text-white px-3 py-2 transition-colors duration-200"
                                    >
                                        Not now
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-white/70 mt-0.5">
                                    Tap{' '}
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 font-medium text-white">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                            <polyline points="16 6 12 2 8 6" />
                                            <line x1="12" y1="2" x2="12" y2="15" />
                                        </svg>
                                        Share
                                    </span>
                                    {' '}then <span className="font-medium text-white">Add to Home Screen</span>.
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={dismiss}
                                        className="text-sm text-white/60 hover:text-white px-3 py-2 transition-colors duration-200"
                                    >
                                        Got it
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
