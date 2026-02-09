'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusChip } from '@/components/ui/StatusChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { ActionCard, AccessLane } from '@/components/app/ActionCard'
import { StepperWizard } from '@/components/app/StepperWizard'
import { MessageBubble, MessageDateSeparator } from '@/components/app/MessageBubble'
import { useState } from 'react'

export default function ComponentsPage() {
    const [activeTab, setActiveTab] = useState<'tokens' | 'components' | 'examples'>('tokens')

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Component Library</h1>
                <p className="text-[var(--foreground-muted)]">Whistle Connect Design System</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {(['tokens', 'components', 'examples'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-full font-medium capitalize whitespace-nowrap transition-colors ${activeTab === tab
                            ? 'bg-[var(--brand-navy)] text-white'
                            : 'bg-[var(--neutral-100)] text-[var(--neutral-600)]'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tokens Tab */}
            {activeTab === 'tokens' && (
                <div className="space-y-8">
                    {/* Brand Colors */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Brand Colors</h2>
                        <div className="grid grid-cols-3 gap-3">
                            <ColorSwatch name="Blue (Primary)" var="--wc-blue" />
                            <ColorSwatch name="Coach Blue" var="--wc-coach-blue" />
                            <ColorSwatch name="Ref Red" var="--wc-ref-red" />
                        </div>
                    </section>

                    {/* Semantic Colors */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Semantic Colors</h2>
                        <div className="grid grid-cols-3 gap-3">
                            <ColorSwatch name="Primary" var="--color-primary" />
                            <ColorSwatch name="Secondary" var="--color-secondary" />
                            <ColorSwatch name="Accent" var="--color-accent" />
                        </div>
                    </section>

                    {/* Status Colors */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Status Colors</h2>
                        <div className="grid grid-cols-3 gap-3">
                            <ColorSwatch name="Pending" var="--status-pending" />
                            <ColorSwatch name="Offered" var="--status-offered" />
                            <ColorSwatch name="Confirmed" var="--status-confirmed" />
                            <ColorSwatch name="Completed" var="--status-completed" />
                            <ColorSwatch name="Cancelled" var="--status-cancelled" />
                            <ColorSwatch name="Draft" var="--status-draft" />
                        </div>
                    </section>

                    {/* Neutrals */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Neutrals</h2>
                        <div className="grid grid-cols-5 gap-2">
                            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                                <ColorSwatch key={shade} name={`${shade}`} var={`--neutral-${shade}`} small />
                            ))}
                        </div>
                    </section>

                    {/* Typography */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Typography</h2>
                        <div className="card p-4 space-y-4">
                            <div className="text-3xl font-bold">Heading 3XL</div>
                            <div className="text-2xl font-bold">Heading 2XL</div>
                            <div className="text-xl font-semibold">Heading XL</div>
                            <div className="text-lg font-semibold">Heading LG</div>
                            <div className="text-base">Body Base</div>
                            <div className="text-sm">Body Small</div>
                            <div className="text-xs">Caption XS</div>
                        </div>
                    </section>

                    {/* Spacing */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Spacing</h2>
                        <div className="space-y-2">
                            {[
                                { name: 'XS', size: '4px' },
                                { name: 'SM', size: '8px' },
                                { name: 'MD', size: '16px' },
                                { name: 'LG', size: '24px' },
                                { name: 'XL', size: '32px' },
                                { name: '2XL', size: '48px' },
                            ].map((space) => (
                                <div key={space.name} className="flex items-center gap-3">
                                    <span className="text-sm w-12 text-[var(--foreground-muted)]">{space.name}</span>
                                    <div
                                        className="bg-[var(--brand-primary)] h-4"
                                        style={{ width: space.size }}
                                    />
                                    <span className="text-xs text-[var(--neutral-400)]">{space.size}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Border Radius */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Border Radius</h2>
                        <div className="flex gap-4 flex-wrap">
                            <div className="w-16 h-16 bg-[var(--neutral-200)] rounded-[var(--radius-sm)] flex items-center justify-center text-xs">SM</div>
                            <div className="w-16 h-16 bg-[var(--neutral-200)] rounded-[var(--radius-md)] flex items-center justify-center text-xs">MD</div>
                            <div className="w-16 h-16 bg-[var(--neutral-200)] rounded-[var(--radius-lg)] flex items-center justify-center text-xs">LG</div>
                            <div className="w-16 h-16 bg-[var(--neutral-200)] rounded-[var(--radius-xl)] flex items-center justify-center text-xs">XL</div>
                            <div className="w-16 h-16 bg-[var(--neutral-200)] rounded-full flex items-center justify-center text-xs">Full</div>
                        </div>
                    </section>
                </div>
            )}

            {/* Components Tab */}
            {activeTab === 'components' && (
                <div className="space-y-8">
                    {/* Buttons */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Buttons</h2>
                        <div className="card p-4 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Button>Primary</Button>
                                <Button variant="secondary">Secondary</Button>
                                <Button variant="outline">Outline</Button>
                                <Button variant="ghost">Ghost</Button>
                                <Button variant="danger">Danger</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm">Small</Button>
                                <Button size="md">Medium</Button>
                                <Button size="lg">Large</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button loading>Loading</Button>
                                <Button disabled>Disabled</Button>
                            </div>
                        </div>
                    </section>

                    {/* Inputs */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Inputs</h2>
                        <div className="card p-4 space-y-4">
                            <Input label="Default Input" placeholder="Enter text..." />
                            <Input label="With Hint" placeholder="Enter email..." hint="We'll never share your email" />
                            <Input label="With Error" placeholder="Enter password..." error="Password is required" />
                            <Input label="Disabled" placeholder="..." disabled />
                        </div>
                    </section>

                    {/* Select */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Select</h2>
                        <div className="card p-4">
                            <Select
                                label="Match Format"
                                options={[
                                    { value: '5v5', label: '5-a-side' },
                                    { value: '7v7', label: '7-a-side' },
                                    { value: '11v11', label: '11-a-side' },
                                ]}
                                placeholder="Select format"
                            />
                        </div>
                    </section>

                    {/* Status Chips */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Status Chips</h2>
                        <div className="card p-4">
                            <div className="flex flex-wrap gap-2">
                                <StatusChip status="draft" />
                                <StatusChip status="pending" />
                                <StatusChip status="offered" />
                                <StatusChip status="confirmed" />
                                <StatusChip status="completed" />
                                <StatusChip status="cancelled" />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <StatusChip status="coach" />
                                <StatusChip status="referee" />
                                <StatusChip status="admin" />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <StatusChip status="verified" />
                            </div>
                        </div>
                    </section>

                    {/* Cards */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Cards</h2>
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Card Title</CardTitle>
                                    <CardDescription>This is a card description</CardDescription>
                                </CardHeader>
                                <p className="text-sm">Card content goes here</p>
                            </Card>
                            <Card hover>
                                <p className="text-sm">Hoverable card with shadow effect</p>
                            </Card>
                        </div>
                    </section>

                    {/* Action Cards */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Action Cards</h2>
                        <div className="space-y-3">
                            <ActionCard
                                icon={<span>📅</span>}
                                title="Book a Referee"
                                subtitle="Find and book officials"
                                variant="primary"
                            />
                            <ActionCard
                                icon={<span>🔒</span>}
                                title="Coming Soon"
                                subtitle="This feature is disabled"
                                disabled
                            />
                        </div>
                    </section>

                    {/* Access Lanes */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Access Lanes</h2>
                        <div className="space-y-2">
                            <AccessLane icon={<span>⚽</span>} title="Referee Access" variant="referee" />
                            <AccessLane icon={<span>👥</span>} title="Coach Access" variant="coach" />
                        </div>
                    </section>

                    {/* Stepper */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Stepper Wizard</h2>
                        <div className="card p-4">
                            <StepperWizard
                                steps={[
                                    { title: 'When' },
                                    { title: 'Where' },
                                    { title: 'Details' },
                                ]}
                                currentStep={1}
                            />
                        </div>
                    </section>

                    {/* Message Bubbles */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Message Bubbles</h2>
                        <div className="card p-4 bg-[var(--neutral-50)]">
                            <MessageBubble
                                message={{
                                    id: '1',
                                    thread_id: '1',
                                    sender_id: 'other',
                                    kind: 'user',
                                    body: 'Hi, looking forward to the match!',
                                    created_at: new Date().toISOString(),
                                    sender: { id: 'other', full_name: 'John Smith', role: 'coach', phone: null, postcode: null, avatar_url: null, created_at: '', updated_at: '' }
                                }}
                                isOwn={false}
                                showSender
                            />
                            <MessageBubble
                                message={{
                                    id: '2',
                                    thread_id: '1',
                                    sender_id: 'me',
                                    kind: 'user',
                                    body: "Thanks! I'll be there 30 minutes early.",
                                    created_at: new Date().toISOString(),
                                }}
                                isOwn={true}
                            />
                            <MessageBubble
                                message={{
                                    id: '3',
                                    thread_id: '1',
                                    sender_id: null,
                                    kind: 'system',
                                    body: 'Booking confirmed',
                                    created_at: new Date().toISOString(),
                                }}
                                isOwn={false}
                            />
                        </div>
                    </section>

                    {/* Empty State */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Empty State</h2>
                        <div className="card">
                            <EmptyState
                                icon={<span className="text-4xl">📭</span>}
                                title="No messages"
                                description="Start a conversation with a referee or coach"
                                action={<Button size="sm">Send Message</Button>}
                            />
                        </div>
                    </section>

                    {/* Skeleton */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Skeleton Loading</h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                            <SkeletonCard />
                        </div>
                    </section>
                </div>
            )}

            {/* Examples Tab */}
            {activeTab === 'examples' && (
                <div className="space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Composed: Home Dashboard</h2>
                        <div className="card p-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center font-bold">
                                    JS
                                </div>
                                <div>
                                    <h3 className="font-semibold">Hello, John!</h3>
                                    <p className="text-sm text-[var(--foreground-muted)]">Manage your bookings</p>
                                </div>
                            </div>
                            <ActionCard
                                icon={<span>➕</span>}
                                title="Book a Referee"
                                subtitle="Create a new booking"
                                variant="primary"
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-4">Composed: Booking Card</h2>
                        <div className="card p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h3 className="font-semibold">Riverside Fields</h3>
                                    <p className="text-sm text-[var(--foreground-muted)]">SW1A 1AA</p>
                                </div>
                                <StatusChip status="confirmed" size="sm" />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-[var(--foreground-muted)]">
                                <span>📅 Sat, Jan 4</span>
                                <span>⏰ 10:00am</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <span className="px-2 py-0.5 bg-[var(--neutral-100)] rounded text-xs">11v11</span>
                                <span className="px-2 py-0.5 bg-[var(--neutral-100)] rounded text-xs">U14</span>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-4">Theme Support</h2>
                        <div className="card p-4 space-y-4">
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Try adding <code className="bg-[var(--neutral-100)] px-1 rounded">?theme=red</code> or{' '}
                                <code className="bg-[var(--neutral-100)] px-1 rounded">?theme=blue</code> to the URL
                            </p>
                            <div className="flex gap-2">
                                <a href="?role=coach" className="px-3 py-1 bg-[var(--wc-coach-blue)] text-white rounded text-sm">Coach Style</a>
                                <a href="?role=referee" className="px-3 py-1 bg-[var(--wc-ref-red)] text-white rounded text-sm">Referee Style</a>
                                <a href="?" className="px-3 py-1 bg-[var(--brand-primary)] text-white rounded text-sm">Default</a>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    )
}

// Helper component for color swatches
function ColorSwatch({ name, var: cssVar, small }: { name: string; var: string; small?: boolean }) {
    return (
        <div className={small ? 'text-center' : ''}>
            <div
                className={`${small ? 'w-10 h-10' : 'w-full h-16'} rounded-lg border border-[var(--border-color)]`}
                style={{ backgroundColor: `var(${cssVar})` }}
            />
            <p className={`mt-1 ${small ? 'text-[10px]' : 'text-xs'} text-[var(--foreground-muted)]`}>{name}</p>
        </div>
    )
}
