import { useState } from "react";
import { Calendar, MapPin, Filter } from "lucide-react";

// Mock Data for Coach View
const MOCK_COACH_MATCHES = [
    { id: 1, date: "2025-12-01T14:00:00", location: "Hackney Marshes", status: "pending", ageGroup: "U14", referee: null },
    { id: 2, date: "2025-12-08T10:00:00", location: "Regent's Park", status: "confirmed", ageGroup: "U12", referee: "John Smith" },
];

export default function CoachDashboard() {
    const [activeTab, setActiveTab] = useState<'search' | 'bookings' | 'messages'>('search');
    const [matches] = useState(MOCK_COACH_MATCHES);

    return (
        <div className="min-h-screen bg-background text-foreground pb-20 font-sans">
            {/* Header */}
            <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-10 shadow-md">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex flex-col">
                        <h1 className="font-heading text-xl font-bold text-white uppercase tracking-tight">Whistle Connect</h1>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Coach Portal</span>
                    </div>
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center border border-primary/50">
                        <span className="font-bold text-xs text-primary">C</span>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 space-y-6 mt-4">
                {/* Navigation Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50">
                    {['search', 'bookings', 'messages'].map((tab) => (
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

                {activeTab === 'search' && (
                    <div className="space-y-6">
                        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
                            <h2 className="font-heading text-lg font-bold text-white mb-4 uppercase">Find a Referee</h2>
                            <div className="space-y-4">
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Enter location or postcode"
                                        className="w-full bg-input border-none text-white pl-10 p-3 rounded focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex-1 btn-cyber bg-muted hover:bg-muted/80 text-white py-3 rounded flex items-center justify-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-sm font-bold uppercase">Date</span>
                                    </button>
                                    <button className="flex-1 btn-cyber bg-muted hover:bg-muted/80 text-white py-3 rounded flex items-center justify-center gap-2">
                                        <Filter className="w-4 h-4" />
                                        <span className="text-sm font-bold uppercase">Filters</span>
                                    </button>
                                </div>
                                <button className="w-full btn-cyber bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
                                    Search Referees
                                </button>
                            </div>
                        </div>

                        <div className="text-center py-8">
                            <p className="text-muted-foreground text-sm">Enter your match details to find qualified referees in your area.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'bookings' && (
                    <div className="space-y-4">
                        <h3 className="font-heading text-lg font-bold text-white uppercase">My Matches</h3>
                        {matches.map(match => (
                            <div key={match.id} className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(match.date).toLocaleDateString()}
                                    </div>
                                    <h4 className="font-bold text-white text-sm">{match.location}</h4>
                                    <span className="text-xs text-muted-foreground">{match.ageGroup} • {match.referee || "No Referee Assigned"}</span>
                                </div>
                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${match.status === 'confirmed' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                                    }`}>
                                    {match.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>No messages yet.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
