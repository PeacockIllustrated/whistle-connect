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

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Header */}
            <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-10">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <h1 className="font-heading text-2xl text-primary italic uppercase">Whistle Connect</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center border border-primary">
                            <span className="font-bold text-primary">{user.role[0].toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 space-y-8 mt-6">

                {/* Stats & Gamification Section (Referee Only) */}
                {user.role === "referee" && (
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Profile Card */}
                        <div className="bg-card border border-border p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/10 -skew-x-12 transform translate-x-8 -translate-y-8" />
                            <div className="flex items-center gap-4 mb-4">
                                <Shield className="w-8 h-8 text-secondary" />
                                <div>
                                    <h3 className="font-heading text-lg uppercase">Referee Profile</h3>
                                    <p className="text-xs text-muted-foreground">{user.profile.level} • {user.profile.county}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Matches Officiated</span>
                                    <span className="font-mono text-primary">{user.profile.matchesOfficiated}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Consecutive</span>
                                    <span className="font-mono text-secondary">{user.profile.consecutiveBookings}</span>
                                </div>
                            </div>
                        </div>

                        {/* Badges Card */}
                        <div className="bg-card border border-border p-6 md:col-span-2">
                            <h3 className="font-heading text-lg uppercase mb-4 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-accent" />
                                Whistle Rewards
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                {user.badges.map(badge => {
                                    const details = GamificationEngine.getBadgeDetails(badge);
                                    return (
                                        <div key={badge} className="flex-shrink-0 w-32 bg-muted/50 p-3 border border-primary/30 flex flex-col items-center text-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                <Trophy className="w-5 h-5 text-primary" />
                                            </div>
                                            <span className="text-xs font-bold uppercase">{details?.name}</span>
                                        </div>
                                    );
                                })}
                                {/* Locked Badge Preview */}
                                <div className="flex-shrink-0 w-32 bg-muted/20 p-3 border border-dashed border-muted-foreground/30 flex flex-col items-center text-center gap-2 opacity-60">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                        <Trophy className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <span className="text-xs font-bold uppercase">{nextBadge?.name}</span>
                                    <div className="w-full h-1 bg-muted mt-1">
                                        <div className="h-full bg-primary" style={{ width: `${progressToCentury}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Booking System / Matches */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-heading text-2xl uppercase text-white">
                            {user.role === "coach" ? "My Bookings" : "Match Requests"}
                        </h2>
                        {user.role === "coach" && (
                            <button className="btn-cyber bg-primary text-primary-foreground px-6 py-2">
                                <span className="btn-cyber-content flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Book Referee
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {matches.map(match => (
                            <div key={match.id} className="bg-card border border-border p-4 flex items-center justify-between hover:border-primary/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-12 ${match.status === 'confirmed' ? 'bg-primary' : 'bg-secondary'} -skew-x-12`} />
                                    <div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(match.date).toLocaleDateString()} • {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-accent" />
                                            {match.location}
                                        </h3>
                                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase tracking-wider mt-1 inline-block">
                                            {match.ageGroup}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {user.role === "referee" && match.status === "pending" ? (
                                        <>
                                            <button
                                                onClick={() => handleAcceptMatch(match.id)}
                                                className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/40 flex items-center justify-center text-primary transition-colors"
                                            >
                                                <CheckCircle className="w-6 h-6" />
                                            </button>
                                            <button className="w-10 h-10 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center text-destructive transition-colors">
                                                <XCircle className="w-6 h-6" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border ${match.status === 'confirmed'
                                            ? 'border-primary text-primary'
                                            : 'border-secondary text-secondary'
                                            }`}>
                                            {match.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>
        </div>
    );
}
