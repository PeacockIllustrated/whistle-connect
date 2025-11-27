import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Whistle } from "lucide-react";

export default function AuthPage() {
    const [role, setRole] = useState<"coach" | "referee" | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [faNumber, setFaNumber] = useState("");
    const [county, setCounty] = useState("");
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. Create User Record (Mocking DB insertion for prototype if needed, 
                // or relying on Supabase triggers. For this prototype, we'll assume 
                // the user is created and we just log the "Magic Link" for referees)

                if (role === "referee") {
                    console.log("MAGIC LINK EMAIL SENT TO COUNTY FA:", {
                        email,
                        faNumber,
                        county,
                        verificationLink: `https://whistle-connect.com/verify?uid=${authData.user.id}`
                    });

                    toast({
                        title: "Verification Pending",
                        description: "Your application has been sent to the County FA for verification.",
                    });
                } else {
                    toast({
                        title: "Welcome Coach!",
                        description: "Account created successfully.",
                    });
                }

                // Redirect to dashboard
                setLocation("/");
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-heading font-bold text-primary tracking-tighter uppercase italic">
                        Whistle Connect
                    </h1>
                    <p className="text-muted-foreground">The Cyber Sport Network</p>
                </div>

                <div className="bg-card border border-border p-8 shadow-2xl relative overflow-hidden">
                    {/* Decorative skew element */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 -skew-x-12 transform translate-x-10 -translate-y-10" />

                    {!role ? (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-heading text-white text-center">Select Your Role</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setRole("coach")}
                                    className="group relative h-32 bg-muted hover:bg-primary/20 border border-border hover:border-primary transition-all duration-300 flex flex-col items-center justify-center gap-2"
                                >
                                    <Whistle className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                                    <span className="font-heading uppercase tracking-wider text-lg">Coach</span>
                                </button>
                                <button
                                    onClick={() => setRole("referee")}
                                    className="group relative h-32 bg-muted hover:bg-secondary/20 border border-border hover:border-secondary transition-all duration-300 flex flex-col items-center justify-center gap-2"
                                >
                                    <Shield className="w-8 h-8 text-secondary group-hover:scale-110 transition-transform" />
                                    <span className="font-heading uppercase tracking-wider text-lg">Referee</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSignUp} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-heading text-white">
                                    {role === "coach" ? "Coach Registration" : "Referee Registration"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setRole(null)}
                                    className="text-xs text-muted-foreground hover:text-primary underline"
                                >
                                    Change Role
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-primary mt-1"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-primary mt-1"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>

                                {role === "referee" && (
                                    <>
                                        <div>
                                            <label className="text-xs uppercase tracking-wider text-muted-foreground">FA Number</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-secondary mt-1"
                                                value={faNumber}
                                                onChange={(e) => setFaNumber(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs uppercase tracking-wider text-muted-foreground">County</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-input border-none text-white p-3 focus:ring-1 focus:ring-secondary mt-1"
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
                                    {role === "coach" ? "Join as Coach" : "Submit for Verification"}
                                </span>
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
