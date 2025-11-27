import { useLocation } from "wouter";
import CoachDashboard from "./coach-dashboard";
import RefereeDashboard from "./referee-dashboard";

// Mock User Role for Prototype - In a real app, this would come from Auth Context
// Change this to 'coach' or 'referee' to test different views
const MOCK_USER_ROLE = "coach";

export default function Dashboard() {
    const [, _setLocation] = useLocation();

    // In a real app, we would check the user's role from the auth context
    // const { user } = useAuth();
    // const role = user?.role;

    const role = MOCK_USER_ROLE;

    if (role === "coach") {
        return <CoachDashboard />;
    }

    if (role === "referee") {
        return <RefereeDashboard />;
    }

    return <div>Unknown Role</div>;
}
