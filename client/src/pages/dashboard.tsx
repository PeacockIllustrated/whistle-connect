import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Trophy, Calendar, MapPin, CheckCircle, XCircle } from "lucide-react";
import { GamificationEngine, BadgeCode } from "@/lib/gamification";

// Mock Data for Prototype
const MOCK_USER = {
    id: 1,
    role: "referee", // Change to 'coach' to test coach view
    email: "ref@example.com",
    profile: {
        faNumber: "123456",
        level: "Level 7",
        county: "London FA",
        matchesOfficiated: 98,
        consecutiveBookings: 4,
    },
    badges: ["iron_man"] as BadgeCode[],
};

const MOCK_MATCHES = [
    { id: 1, date: "2025-12-01T14:00:00", location: "Hackney Marshes", status: "pending", ageGroup: "U14" },
    { id: 2, date: "2025-12-08T10:00:00", location: "Regent's Park", status: "confirmed", ageGroup: "U12" },
];

export default function Dashboard() {
    const [, _setLocation] = useLocation();
    const user = MOCK_USER;
    const [matches, setMatches] = useState(MOCK_MATCHES);

    // Gamification Logic Check (Simulation)
    const nextBadge = GamificationEngine.getBadgeDetails('century_club');
    const progressToCentury = (user.profile.matchesOfficiated / 100) * 100;

    const handleAcceptMatch = (id: number) => {
        setMatches(matches.map(m => m.id === id ? { ...m, status: "confirmed" } : m));
        // Simulate post-match update
        // user.profile.matchesOfficiated++;
    };

    const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'messages' | 'manage'>('overview');

    return (
        <div className="min-h-screen bg-background text-foreground pb-20 font-sans">
            {/* Header */}
            <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-10 shadow-md">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex flex-col">
                        <h1 className="font-heading text-xl font-bold text-white uppercase tracking-tight">Whistle Connect</h1>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">FA Referee Management</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center border border-border">
                            <span className="font-bold text-xs text-muted-foreground">{user.role[0].toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 space-y-6 mt-4">
                {/* Navigation Tabs (Mobile-First) */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50">
                    {['overview', 'search', 'messages', 'manage'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stats Overview */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Matches</span>
                                <div className="text-2xl font-bold text-white mt-1">{user.profile.matchesOfficiated}</div>
                            </div>
                            <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Level</span>
                                <div className="text-2xl font-bold text-primary mt-1">{user.profile.level}</div>
                            </div>
                        </div>

                        {/* Recent Activity / Matches */}
                        <div>
                            <h3 className="font-heading text-lg font-bold text-white mb-4 uppercase">Upcoming Matches</h3>
                            <div className="space-y-3">
                                {matches.map(match => (
                                    <div key={match.id} className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-1 h-10 rounded-full ${match.status === 'confirmed' ? 'bg-primary' : 'bg-secondary'}`} />
                                            <div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(match.date).toLocaleDateString()}
                                                </div>
                                                <h4 className="font-bold text-white text-sm">{match.location}</h4>
                                                <span className="text-xs text-muted-foreground">{match.ageGroup}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            {match.status === 'pending' && user.role === 'referee' ? (
                                                <button
                                                    onClick={() => handleAcceptMatch(match.id)}
                                                    className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase rounded hover:bg-primary/90 transition-colors"
                                                >
                                                    Accept
                                                </button>
                                            ) : (
                                                <span className={`text-xs font-bold uppercase ${match.status === 'confirmed' ? 'text-primary' : 'text-secondary'}`}>
                                                    {match.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>Search functionality coming soon.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
