import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { ALL_BADGE_CODES, GamificationEngine } from "@/lib/gamification";
import {
    Trophy, Shield, Zap, Star, MapPin, Award,
    Footprints, ShieldCheck, Sunrise, Cog, Milestone,
    GraduationCap, Users, Compass, Crown, BookOpen, Sparkles, Lock
} from "lucide-react";

// Map icon strings to Lucide components
const IconMap: Record<string, any> = {
    Footprints, ShieldCheck, Sunrise, Star, Cog, MapPin, Milestone,
    GraduationCap, Users, Trophy, Compass, Crown, Zap, BookOpen, Sparkles,
    Shield, Award
};

export default function BadgesTab() {
    const { profile } = useAuth();
    const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.id) {
            fetchUserBadges();
        } else {
            setLoading(false);
        }
    }, [profile?.id]);

    const fetchUserBadges = async () => {
        try {
            const { data, error } = await supabase
                .from('user_badges')
                .select('badge_id, badges(code)')
                .eq('user_id', profile.id);

            if (error) throw error;

            const unlocked = new Set<string>();
            data?.forEach((item: any) => {
                if (item.badges?.code) {
                    unlocked.add(item.badges.code);
                }
            });
            setUnlockedBadges(unlocked);
        } catch (error) {
            console.error("Error fetching badges:", error);
        } finally {
            setLoading(false);
        }
    };

    // Categorize badges by XP/Difficulty
    const categories = {
        rookie: [] as any[],
        pro: [] as any[],
        elite: [] as any[]
    };

    ALL_BADGE_CODES.forEach(code => {
        const details = GamificationEngine.getBadgeDetails(code);
        if (!details) return;

        const badge = { ...details, code, unlocked: unlockedBadges.has(code) };

        if (details.xp < 250) {
            categories.rookie.push(badge);
        } else if (details.xp < 500) {
            categories.pro.push(badge);
        } else {
            categories.elite.push(badge);
        }
    });

    const renderBadgeCard = (badge: any) => {
        const Icon = IconMap[badge.icon] || Trophy;
        const isUnlocked = badge.unlocked;

        return (
            <div
                key={badge.code}
                className={`
                    relative group p-4 rounded-xl border transition-all duration-300
                    ${isUnlocked
                        ? 'bg-card border-secondary/50 shadow-[0_0_15px_rgba(250,204,21,0.1)] hover:shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:-translate-y-1'
                        : 'bg-card/50 border-border/50 opacity-70 grayscale hover:grayscale-0 hover:opacity-100'
                    }
                `}
            >
                {/* Locked Overlay Icon */}
                {!isUnlocked && (
                    <div className="absolute top-2 right-2 text-muted-foreground/50">
                        <Lock className="w-4 h-4" />
                    </div>
                )}

                <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`
                        w-16 h-16 rounded-full flex items-center justify-center mb-2
                        ${isUnlocked
                            ? 'bg-secondary/10 text-secondary ring-2 ring-secondary/20'
                            : 'bg-muted text-muted-foreground'
                        }
                    `}>
                        <Icon className="w-8 h-8" />
                    </div>

                    <div>
                        <h4 className={`font-bold text-sm uppercase tracking-wide ${isUnlocked ? 'text-white' : 'text-muted-foreground'}`}>
                            {badge.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {badge.description}
                        </p>
                    </div>

                    <div className={`
                        px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                        ${isUnlocked ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}
                    `}>
                        {badge.xp} XP
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Stats */}
            <div className="bg-gradient-to-r from-secondary/20 to-primary/20 p-6 rounded-2xl border border-secondary/20 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-heading font-bold text-white uppercase italic">Hall of Fame</h2>
                    <p className="text-muted-foreground text-sm">Track your career achievements</p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-secondary">{unlockedBadges.size} / {ALL_BADGE_CODES.length}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Badges Unlocked</div>
                </div>
            </div>

            {/* Elite Tier */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Crown className="w-6 h-6 text-yellow-500" />
                    <h3 className="text-xl font-heading font-bold text-yellow-500 uppercase tracking-widest">Elite Tier</h3>
                    <div className="h-px bg-yellow-500/20 flex-1" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.elite.map(renderBadgeCard)}
                </div>
            </div>

            {/* Pro Tier */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-gray-300" />
                    <h3 className="text-xl font-heading font-bold text-gray-300 uppercase tracking-widest">Pro Tier</h3>
                    <div className="h-px bg-gray-300/20 flex-1" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.pro.map(renderBadgeCard)}
                </div>
            </div>

            {/* Rookie Tier */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 text-orange-400" />
                    <h3 className="text-xl font-heading font-bold text-orange-400 uppercase tracking-widest">Rookie Tier</h3>
                    <div className="h-px bg-orange-400/20 flex-1" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.rookie.map(renderBadgeCard)}
                </div>
            </div>
        </div>
    );
}
