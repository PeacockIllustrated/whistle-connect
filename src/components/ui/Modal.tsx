'use client'

import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

export interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'full'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true)
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen && !isAnimating) return null

    return (
        <div
            className={cn(
                'fixed inset-0 z-50',
                'transition-opacity duration-200',
                isOpen ? 'opacity-100' : 'opacity-0'
            )}
            onTransitionEnd={() => !isOpen && setIsAnimating(false)}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={cn(
                    'absolute bottom-0 left-0 right-0',
                    'bg-white rounded-t-2xl',
                    'transform transition-transform duration-300 ease-out',
                    'safe-area-bottom',
                    {
                        'max-h-[40vh]': size === 'sm',
                        'max-h-[60vh]': size === 'md',
                        'max-h-[80vh]': size === 'lg',
                        'max-h-[95vh]': size === 'full',
                    },
                    isOpen ? 'translate-y-0' : 'translate-y-full'
                )}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-[var(--neutral-300)]" />
                </div>

                {/* Header */}
                {title && (
                    <div className="px-4 pb-3 border-b border-[var(--border-color)]">
                        <h2 className="text-lg font-semibold text-center">{title}</h2>
                    </div>
                )}

                {/* Content */}
                <div className="px-4 py-4 overflow-y-auto max-h-[calc(100%-60px)]">
                    {children}
                </div>
            </div>
        </div>
    )
}

// Confirmation dialog variant
export interface ConfirmDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary'
}: ConfirmDialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <p className="text-[var(--foreground-muted)] mb-6">{message}</p>
            <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-lg border border-[var(--border-color)] font-medium"
                >
                    {cancelLabel}
                </button>
                <button
                    onClick={() => {
                        onConfirm()
                        onClose()
                    }}
                    className={cn(
                        'flex-1 py-3 px-4 rounded-lg font-medium text-white',
                        variant === 'danger' ? 'bg-red-600' : 'bg-[var(--color-primary)]'
                    )}
                >
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    )
}
