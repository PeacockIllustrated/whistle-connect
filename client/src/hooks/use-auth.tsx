import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
    user: User | null;
    session: Session | null;
    profile: any | null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setLoading(false);
            }
        });

        // 2. Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (currentUser: User) => {
        try {
            // Check if user is referee or coach based on metadata or table query
            // For now, we'll try to fetch from profiles_referee first
            // In a real app, we might store 'role' in user_metadata or a separate 'users' table

            // We are using a 'users' table in our schema that mirrors auth.users
            // Let's fetch the role from there first
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('email', currentUser.email)
                .single();

            if (userError) {
                console.error("Error fetching user role:", userError);
                // Fallback or handle error
            }

            if (userData?.role === 'referee') {
                const { data: profileData } = await supabase
                    .from('profiles_referee')
                    .select('*')
                    .eq('user_id', userData.id) // Note: schema uses integer ID, but auth uses UUID. 
                    // We need to ensure our 'users' table is linked correctly.
                    // For this prototype, we might need to adjust how we link auth.users to public.users
                    .single();

                if (profileData) {
                    setProfile({ ...userData, ...profileData });
                } else {
                    setProfile(userData);
                }
            } else {
                setProfile(userData);
            }

        } catch (error) {
            console.error("Error fetching profile:", error);
            toast({
                title: "Error loading profile",
                description: "Could not load user data.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        toast({
            title: "Signed out",
            description: "You have been signed out successfully.",
        });
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
