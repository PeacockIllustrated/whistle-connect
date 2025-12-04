import { useState, useEffect } from "react";
import { Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import BadgesTab from "@/components/badges-tab";

export default function RefereeDashboard() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'availability' | 'badges'>('overview');
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (profile?.id) {
            fetchMatches();
        }
    }, [profile?.id]);

    const fetchMatches = async () => {
        setLoading(true);
        try {
            // Fetch matches where referee is assigned OR open requests (referee_id is null)
            // For this prototype, 'requests' will be open matches that any referee can see/accept
            const { data, error } = await supabase
                .from('matches')
                .select('*')
                .or(`referee_id.eq.${profile.id},referee_id.is.null`)
                .order('date', { ascending: true });

            if (error) throw error;
            setMatches(data || []);
        } catch (error) {
            console.error("Error fetching matches:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptMatch = async (id: number) => {
        try {
            const { error } = await supabase
                .from('matches')
                .update({
                    status: 'confirmed',
                    referee_id: profile.id
                })
                .eq('id', id);

            if (error) throw error;

            toast({
                title: "Match Accepted",
                description: "You have been assigned to this match.",
            });
            fetchMatches(); // Refresh list
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        }
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
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50 no-scrollbar">
                    {['overview', 'requests', 'availability', 'badges'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === tab
                                ? 'border-secondary text-secondary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Stats Overview */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Matches</span>
                                <div className="text-2xl font-bold text-white mt-1">{profile?.matches_officiated || 0}</div>
                            </div>
                            <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Level</span>
                                <div className="text-2xl font-bold text-secondary mt-1">{profile?.level || "N/A"}</div>
                            </div>
                        </div>

                        {/* Upcoming Matches */}
                        <div>
                            <h3 className="font-heading text-lg font-bold text-white mb-4 uppercase">Upcoming Matches</h3>
                            <div className="space-y-3">
                                {loading ? (
                                    <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                                ) : matches.filter(m => m.status === 'confirmed' && m.referee_id === profile.id).length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No upcoming confirmed matches.</p>
                                ) : (
                                    matches.filter(m => m.status === 'confirmed' && m.referee_id === profile.id).map(match => (
                                        <div key={match.id} className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:border-secondary/50 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(match.date).toLocaleDateString()}
                                                </div>
                                                <h4 className="font-bold text-white text-sm">{match.location}</h4>
                                                <span className="text-xs text-muted-foreground">{match.age_group} • {match.fee}</span>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="font-heading text-lg font-bold text-white uppercase">Match Requests</h3>
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                        ) : matches.filter(m => m.status === 'pending' && m.referee_id === null).length === 0 ? (
                            <p className="text-muted-foreground text-sm">No pending match requests.</p>
                        ) : (
                            matches.filter(m => m.status === 'pending' && m.referee_id === null).map(match => (
                                <div key={match.id} className="bg-card border border-border p-4 rounded-lg space-y-4 hover:border-secondary/50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(match.date).toLocaleDateString()}
                                            </div>
                                            <h4 className="font-bold text-white text-lg">{match.location}</h4>
                                            <span className="text-sm text-muted-foreground">{match.age_group} • {match.fee}</span>
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
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'availability' && (
                    <div className="text-center py-10 text-muted-foreground animate-in fade-in slide-in-from-bottom-4">
                        <p>Availability calendar coming soon.</p>
                    </div>
                )}

                {activeTab === 'badges' && (
                    <BadgesTab />
                )}
            </main>
        </div>
    );
}
