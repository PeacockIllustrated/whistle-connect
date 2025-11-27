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
    const role = profile?.role;

    if (role === "coach") {
        return <CoachDashboard />;
    }

    if (role === "referee") {
        return <RefereeDashboard />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-white">
            <div className="text-center">
                <h2 className="text-xl font-bold mb-2">Unknown Role</h2>
                <p className="text-muted-foreground">Please contact support.</p>
            </div>
        </div>
    );
}
