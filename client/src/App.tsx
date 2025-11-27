import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard"; // Will be refactored later
import NotFound from "@/pages/not-found";

function Router() {
    return (
        <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/auth/:role" component={AuthPage} />
            <Route path="/dashboard" component={Dashboard} />
            <Route component={NotFound} />
        </Switch>
    );
}

import { NavigationToolbar } from "@/components/navigation-toolbar";
import { AuthProvider } from "@/hooks/use-auth";

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <Router />
                <NavigationToolbar />
                <Toaster />
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;
