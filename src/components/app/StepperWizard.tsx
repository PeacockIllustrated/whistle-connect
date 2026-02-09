import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export interface StepperStep {
    title: string
    description?: string
}

export interface StepperWizardProps {
    steps: StepperStep[]
    currentStep: number
    className?: string
}

export function StepperWizard({ steps, currentStep, className }: StepperWizardProps) {
    return (
        <div className={cn('flex items-center justify-between', className)}>
            {steps.map((step, index) => {
                const isActive = index === currentStep
                const isCompleted = index < currentStep
                const isLast = index === steps.length - 1

                return (
                    <div key={index} className="flex items-center flex-1">
                        {/* Step Circle & Label */}
                        <div className="flex flex-col items-center">
                            <div
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                                    {
                                        'bg-[var(--color-primary)] text-white': isActive || isCompleted,
                                        'bg-[var(--neutral-200)] text-[var(--neutral-500)]': !isActive && !isCompleted,
                                    }
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                ) : (
                                    index + 1
                                )}
                            </div>
                            <span
                                className={cn(
                                    'text-xs mt-1 text-center whitespace-nowrap',
                                    isActive ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--foreground-muted)]'
                                )}
                            >
                                {step.title}
                            </span>
                        </div>

                        {/* Connector Line */}
                        {!isLast && (
                            <div
                                className={cn(
                                    'flex-1 h-0.5 mx-2 mt-[-16px]',
                                    isCompleted ? 'bg-[var(--color-primary)]' : 'bg-[var(--neutral-200)]'
                                )}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// Wizard container with navigation
export interface WizardContainerProps {
    steps: StepperStep[]
    currentStep: number
    onNext?: () => void
    onBack?: () => void
    onSubmit?: () => void
    isSubmitting?: boolean
    canProceed?: boolean
    children: React.ReactNode
    className?: string
}

export function WizardContainer({
    steps,
    currentStep,
    onNext,
    onBack,
    onSubmit,
    isSubmitting = false,
    canProceed = true,
    children,
    className,
}: WizardContainerProps) {
    const isLastStep = currentStep === steps.length - 1

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* Stepper Header */}
            <div className="px-4 py-4 border-b border-[var(--border-color)]">
                <StepperWizard steps={steps} currentStep={currentStep} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                {children}
            </div>

            {/* Navigation */}
            <div className="px-4 py-4 border-t border-[var(--border-color)] bg-white safe-area-bottom">
                <div className="flex gap-3">
                    {currentStep > 0 && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex-1 py-3 px-4 border border-[var(--border-color)] rounded-lg font-medium text-[var(--foreground)]"
                        >
                            Back
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={isLastStep ? onSubmit : onNext}
                        disabled={!canProceed || isSubmitting}
                        className={cn(
                            'flex-1 py-3 px-4 rounded-lg font-medium text-white',
                            'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-colors'
                        )}
                    >
                        {isSubmitting ? 'Submitting...' : isLastStep ? 'Submit' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    )
}
