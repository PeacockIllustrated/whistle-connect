import { Barlow_Semi_Condensed } from 'next/font/google'

// Display voice for the World Cup section: a bold, rounded, semi-condensed face
// that keeps poster impact but sits closer to the Whistle Connect logo wordmark
// than a harsh condensed face would. Exposed as --font-wc-display and consumed
// by the .wc-display utility (globals.css). Body copy stays Inter.
const wcDisplay = Barlow_Semi_Condensed({
    weight: ['700', '800'],
    subsets: ['latin'],
    variable: '--font-wc-display',
    display: 'swap',
})

export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
    return <div className={wcDisplay.variable}>{children}</div>
}
