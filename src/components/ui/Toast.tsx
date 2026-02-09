'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'

export interface ToastProps {
    message: string
    type?: 'success' | 'error' | 'info' | 'warning'
    duration?: number
    onClose?: () => void
}

export function Toast({ message, type = 'info', duration = 4000, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false)
            if (onClose) setTimeout(onClose, 200) // Wait for fade animation
        }, duration)

        return () => clearTimeout(timer)
    }, [duration, onClose])

    const icons = {
        success: <Check className="w-5 h-5" />,
        error: <X className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />,
        info: <Info className="w-5 h-5" />,
    }

    const styles = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-500',
        info: 'bg-blue-600',
    }

    return (
        <div
            className={cn(
                'fixed bottom-20 left-4 right-4 z-50',
                'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
                'text-white font-medium',
                'transition-all duration-200',
                styles[type],
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
        >
            {icons[type]}
            <span className="flex-1">{message}</span>
            <button
                onClick={() => {
                    setIsVisible(false)
                    if (onClose) setTimeout(onClose, 200)
                }}
                className="p-1 hover:bg-white/20 rounded"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}

// Toast container and hook for managing toasts
import { createContext, useContext, useCallback, ReactNode } from 'react'

interface ToastItem extends ToastProps {
    id: string
}

interface ToastContextValue {
    showToast: (props: Omit<ToastProps, 'onClose'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const showToast = useCallback((props: Omit<ToastProps, 'onClose'>) => {
        const id = Math.random().toString(36).slice(2)
        setToasts(prev => [...prev, { ...props, id }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    {...toast}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
