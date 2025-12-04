import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import CoachDashboard from "./coach-dashboard";
import RefereeDashboard from "./referee-dashboard";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
    const [, setLocation] = useLocation();
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!user) {
        setLocation("/");
        return null;
    }

    // Role is stored in the 'users' table which we fetch into 'profile'
    // DEBUG: Allow manual override if role is missing
    const [debugRole, setDebugRole] = useState<"coach" | "referee" | null>(null);
    const role = profile?.role || debugRole;

    if (role === "coach") {
        return <CoachDashboard />;
    }

    if (role === "referee") {
        return <RefereeDashboard />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-white">
            <div className="text-center space-y-6">
                <div>
                    <h2 className="text-xl font-bold mb-2">Unknown Role</h2>
                    <p className="text-muted-foreground">Profile data could not be loaded.</p>
                    <p className="text-xs text-muted-foreground mt-2">User ID: {user.id}</p>
                </div>

                <div className="p-6 border border-dashed border-yellow-500/50 rounded-lg bg-yellow-500/10">
                    <h3 className="text-yellow-500 font-bold mb-4 uppercase tracking-wider text-sm">Debug Mode</h3>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => setDebugRole('coach')}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                        >
                            View as Coach
                        </button>
                        <button
                            onClick={() => setDebugRole('referee')}
                            className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                        >
                            View as Referee
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
