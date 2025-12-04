import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

export default function AuthPage() {
    const [, params] = useRoute("/auth/:role");
    const role = params?.role as "coach" | "referee" | undefined;

    const [isLogin, setIsLogin] = useState(false); // Toggle between Login and Register
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [faNumber, setFaNumber] = useState("");
    const [county, setCounty] = useState("");
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Redirect if invalid role
    useEffect(() => {
        if (role && role !== "coach" && role !== "referee") {
            setLocation("/");
        }
    }, [role, setLocation]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                // --- LOGIN FLOW ---
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                toast({
                    title: "Welcome back!",
                    description: "Signed in successfully.",
                });

                // Redirect handled by checking session or manual
                setTimeout(() => setLocation("/dashboard"), 500);

            } else {
                // --- REGISTER FLOW ---

                // 1. Create Supabase Auth User
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (authError) throw authError;

                if (authData.user) {
                    // 2. Create Profile Record (Unified)
                    const { error: dbError } = await supabase
                        .from('profiles')
                        .insert({
                            id: authData.user.id,
                            email: email,
                            role: role,
                            // Referee specific fields (will be null for coaches)
                            fa_number: role === 'referee' ? faNumber : null,
                            county_text: role === 'referee' ? county : null,
                            verification_status: role === 'referee' ? 'pending' : 'verified' // Coaches auto-verified for now?
                        });

                    if (dbError) {
                        console.error("Error creating profile:", dbError);
                        toast({
                            title: "Error creating profile",
                            description: "Account created but profile setup failed. Please contact support.",
                            variant: "destructive"
                        });
                        // We might want to delete the auth user here to prevent "zombie" accounts
                    } else {
                        if (role === "referee") {
                            toast({
                                title: "Verification Pending",
                                description: "Your application has been sent to the County FA.",
                            });
                        } else {
                            toast({
                                title: "Welcome Coach!",
                                description: "Account created successfully.",
                            });
                        }
                    }

                    // 4. Auto-Login (if session missing)
                    if (!authData.session) {
                        const { error: signInError } = await supabase.auth.signInWithPassword({
                            email,
                            password,
                        });
                        if (signInError) {
                            toast({ title: "Check your email", description: "Please confirm your email." });
                            return;
                        }
                    }

                    setTimeout(() => setLocation("/dashboard"), 500);
                }
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (!role) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
            {/* Back Button */}
            <button
                onClick={() => setLocation("/")}
                className="absolute top-4 left-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
            </button>

            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-heading font-bold text-primary tracking-tighter uppercase italic">
                        Whistle Connect
                    </h1>
                    <p className="text-muted-foreground">The Cyber Sport Network</p>
                </div>

                <div className="bg-card border border-border p-8 shadow-2xl relative overflow-hidden rounded-lg">
                    {/* Decorative skew element */}
                    <div className={`absolute top-0 right-0 w-20 h-20 -skew-x-12 transform translate-x-10 -translate-y-10 ${role === 'coach' ? 'bg-primary/10' : 'bg-secondary/10'}`} />

                    <form onSubmit={handleAuth} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-heading text-white uppercase">
                                {isLogin ? "Sign In" : (role === "coach" ? "Coach Registration" : "Referee Registration")}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-primary mt-1 rounded"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-primary mt-1 rounded"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {!isLogin && role === "referee" && (
                                <>
                                    <div>
                                        <label className="text-xs uppercase tracking-wider text-muted-foreground">FA Number</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-secondary mt-1 rounded"
                                            value={faNumber}
                                            onChange={(e) => setFaNumber(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs uppercase tracking-wider text-muted-foreground">County</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-secondary mt-1 rounded"
                                            value={county}
                                            onChange={(e) => setCounty(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full btn-cyber py-4 text-primary-foreground mt-6 ${role === "coach" ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/90"
                                }`}
                        >
                            <span className="btn-cyber-content flex items-center justify-center gap-2">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isLogin ? "Sign In" : (role === "coach" ? "Join as Coach" : "Submit for Verification")}
                            </span>
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-sm text-muted-foreground hover:text-white underline underline-offset-4"
                            >
                                {isLogin ? "Need an account? Register" : "Already have an account? Sign In"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
