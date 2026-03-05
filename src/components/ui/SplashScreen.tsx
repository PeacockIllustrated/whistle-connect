'use client'

import { useState, useEffect, useCallback } from 'react'

interface SplashScreenProps {
    /** When true, plays every time the page loads. When false, plays once per session. */
    always?: boolean
}

export default function SplashScreen({ always = false }: SplashScreenProps) {
    // Determine initial visibility synchronously (no effect needed)
    const [visible, setVisible] = useState(() => {
        if (typeof window === 'undefined') return false
        if (always) return true
        if (sessionStorage.getItem('splash-shown')) return false
        sessionStorage.setItem('splash-shown', '1')
        return true
    })

    const dismiss = useCallback(() => setVisible(false), [])

    // Auto-dismiss after animation completes (~3.5s)
    useEffect(() => {
        if (!visible) return
        const timer = setTimeout(dismiss, 3500)
        return () => clearTimeout(timer)
    }, [visible, dismiss])

    if (!visible) return null

    return (
        <>
            <style>{`
                @keyframes splashIconIn {
                    0% { opacity: 0; transform: scale(0.7); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes splashGlow {
                    0%, 100% { filter: drop-shadow(0 0 0px transparent); }
                    50% { filter: drop-shadow(0 0 24px rgba(14, 165, 233, 0.6)); }
                }
                @keyframes splashWordmark {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes splashFadeOut {
                    0% { opacity: 1; }
                    100% { opacity: 0; pointer-events: none; }
                }
            `}</style>
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '28px',
                    background: '#1d2557',
                    animation: 'splashFadeOut 1s ease-in-out 2.5s forwards',
                }}
            >
                {/* Whistle icon */}
                <img
                    src="/assets/icon-lightblue.svg"
                    alt=""
                    width={80}
                    height={80}
                    style={{
                        opacity: 0,
                        animation: 'splashIconIn 0.8s ease-out forwards, splashGlow 0.8s ease-in-out 0.8s forwards',
                    }}
                />

                {/* Wordmark */}
                <img
                    src="/assets/wordmark-white.svg"
                    alt="Whistle Connect"
                    width={200}
                    style={{
                        opacity: 0,
                        animation: 'splashWordmark 1s ease-out 1.2s forwards',
                    }}
                />
            </div>
        </>
    )
}
