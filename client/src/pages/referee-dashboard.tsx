import { useState } from "react";
import { Calendar, CheckCircle, XCircle } from "lucide-react";

// Mock Data for Referee View
const MOCK_REFEREE_USER = {
    profile: {
        matchesOfficiated: 98,
        level: "Level 7",
    }
};

const MOCK_REFEREE_MATCHES = [
    { id: 1, date: "2025-12-01T14:00:00", location: "Hackney Marshes", status: "pending", ageGroup: "U14", fee: "£40" },
    { id: 2, date: "2025-12-08T10:00:00", location: "Regent's Park", status: "confirmed", ageGroup: "U12", fee: "£35" },
];

export default function RefereeDashboard() {
    const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'availability'>('overview');
    const [matches, setMatches] = useState(MOCK_REFEREE_MATCHES);
    const user = MOCK_REFEREE_USER;

    const handleAcceptMatch = (id: number) => {
        setMatches(matches.map(m => m.id === id ? { ...m, status: "confirmed" } : m));
    };

    return (
        <div className="min-h-screen bg-background text-foreground pb-20 font-sans">
            {/* Header */}
            <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-10 shadow-md">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex flex-col">
                        <h1 className="font-heading text-xl font-bold text-white uppercase tracking-tight">Whistle Connect</h1>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Referee Portal</span>
                    </div>
                    <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center border border-secondary/50">
                        <span className="font-bold text-xs text-secondary">R</span>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 space-y-6 mt-4">
                {/* Navigation Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50">
                    {['overview', 'requests', 'availability'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab
                                ? 'border-secondary text-secondary'
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
                                <div className="text-2xl font-bold text-secondary mt-1">{user.profile.level}</div>
                            </div>
                        </div>

                        {/* Upcoming Matches */}
                        <div>
                            <h3 className="font-heading text-lg font-bold text-white mb-4 uppercase">Upcoming Matches</h3>
                            <div className="space-y-3">
                                {matches.filter(m => m.status === 'confirmed').map(match => (
                                    <div key={match.id} className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:border-secondary/50 transition-colors">
                                        <div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(match.date).toLocaleDateString()}
                                            </div>
                                            <h4 className="font-bold text-white text-sm">{match.location}</h4>
                                            <span className="text-xs text-muted-foreground">{match.ageGroup} • {match.fee}</span>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                                    </div>
                                ))}
                                {matches.filter(m => m.status === 'confirmed').length === 0 && (
                                    <p className="text-muted-foreground text-sm">No upcoming confirmed matches.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="space-y-4">
                        <h3 className="font-heading text-lg font-bold text-white uppercase">Match Requests</h3>
                        {matches.filter(m => m.status === 'pending').map(match => (
                            <div key={match.id} className="bg-card border border-border p-4 rounded-lg space-y-4 hover:border-secondary/50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(match.date).toLocaleDateString()}
                                        </div>
                                        <h4 className="font-bold text-white text-lg">{match.location}</h4>
                                        <span className="text-sm text-muted-foreground">{match.ageGroup} • {match.fee}</span>
                                    </div>
                                    <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs font-bold uppercase rounded">New Request</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAcceptMatch(match.id)}
                                        className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2 rounded font-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Accept
                                    </button>
                                    <button className="flex-1 bg-muted hover:bg-muted/80 text-white py-2 rounded font-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors">
                                        <XCircle className="w-4 h-4" /> Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                        {matches.filter(m => m.status === 'pending').length === 0 && (
                            <p className="text-muted-foreground text-sm">No pending match requests.</p>
                        )}
                    </div>
                )}

                {activeTab === 'availability' && (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>Availability calendar coming soon.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
