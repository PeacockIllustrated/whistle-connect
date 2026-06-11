import { Anton } from 'next/font/google'

// Heavy condensed poster face — the promo/display voice for the World Cup
// section only. Exposed as --font-wc-display and consumed by the .wc-display
// utility (globals.css). Body copy stays Inter.
const wcDisplay = Anton({
    weight: '400',
    subsets: ['latin'],
    variable: '--font-wc-display',
    display: 'swap',
})

export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
    return <div className={wcDisplay.variable}>{children}</div>
}
