'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, PartyPopper, Send, UserCheck } from 'lucide-react'

const iconMap = {
    'check-circle': CheckCircle,
    'party-popper': PartyPopper,
    'send': Send,
    'user-check': UserCheck,
}

const iconColorMap = {
    'check-circle': '#3b82f6',   // blue-500
    'party-popper': '#10b981',   // emerald-500
    'send': '#3b82f6',           // blue-500
    'user-check': '#10b981',     // emerald-500
}

interface CelebrationOverlayProps {
    icon: keyof typeof iconMap
    title: string
    subtitle?: string
    /** Called after the overlay finishes fading out (~2.2s) */
    onComplete?: () => void
}

export function CelebrationOverlay({ icon, title, subtitle, onComplete }: CelebrationOverlayProps) {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false)
            onComplete?.()
        }, 2200)
        return () => clearTimeout(timer)
    }, [onComplete])

    if (!visible) return null

    const IconComponent = iconMap[icon]
    const iconColor = iconColorMap[icon]

    return (
        <>
            <style>{`
                @keyframes celebIcon {
                    0% { opacity: 0; transform: scale(0.5); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes celebText {
                    0% { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes celebOut {
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
                    gap: '16px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    animation: 'celebOut 0.6s ease-in-out 1.6s forwards',
                }}
            >
                <IconComponent
                    size={64}
                    color={iconColor}
                    strokeWidth={1.5}
                    style={{
                        opacity: 0,
                        animation: 'celebIcon 0.6s ease-out forwards',
                    }}
                />
                <p
                    style={{
                        opacity: 0,
                        margin: 0,
                        fontSize: '22px',
                        fontWeight: 700,
                        color: '#1e293b',
                        animation: 'celebText 0.6s ease-out 0.4s forwards',
                    }}
                >
                    {title}
                </p>
                {subtitle && (
                    <p
                        style={{
                            opacity: 0,
                            margin: 0,
                            fontSize: '15px',
                            fontWeight: 400,
                            color: '#64748b',
                            animation: 'celebText 0.6s ease-out 0.6s forwards',
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
        </>
    )
}
