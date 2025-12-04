// import { userBadges, badges, profiles } from "../shared/schema";
// import { eq, and } from "drizzle-orm";

export type BadgeCode =
    | 'road_warrior'
    | 'iron_track'
    | 'early_bird'
    | 'top_rated_pro'
    | 'fixture_machine'
    | 'local_legend'
    | 'mile_marker'
    | 'whistle_scholar'
    | 'community_champ'
    | 'tournament_titan'
    | 'seasoned_traveller'
    | 'consistency_king'
    | 'rapid_responder'
    | 'mentor_mode'
    | 'golden_whistle'
    | 'iron_man'
    | 'century_club';

export const ALL_BADGE_CODES: BadgeCode[] = [
    'road_warrior',
    'iron_track',
    'early_bird',
    'top_rated_pro',
    'fixture_machine',
    'local_legend',
    'mile_marker',
    'whistle_scholar',
    'community_champ',
    'tournament_titan',
    'seasoned_traveller',
    'consistency_king',
    'rapid_responder',
    'mentor_mode',
    'golden_whistle',
    'iron_man',
    'century_club'
];

export class GamificationEngine {
    static async checkAchievements(_userId: string, stats: {
        matchesOfficiated: number,
        consecutiveBookings: number,
        distanceTraveled?: number,
        earlyCheckIns?: number,
        averageRating?: number,
        uniqueClubs?: number,
        tournamentDays?: number
    }) {
        const newBadges: BadgeCode[] = [];

        // Iron Man: 5 consecutive bookings
        if (stats.consecutiveBookings >= 5) {
            newBadges.push('iron_man');
        }

        // Century Club: 100 matches
        if (stats.matchesOfficiated >= 100) {
            newBadges.push('century_club');
        }

        // Road Warrior: 200+ miles (approx 322 km)
        if (stats.distanceTraveled && stats.distanceTraveled >= 322) {
            newBadges.push('road_warrior');
        }

        // Fixture Machine: 50 matches
        if (stats.matchesOfficiated >= 50) {
            newBadges.push('fixture_machine');
        }

        // Mile Marker: 100 matches (Same as Century Club? Maybe check-ins vs matches)
        if (stats.matchesOfficiated >= 100) {
            newBadges.push('mile_marker');
        }

        return newBadges;
    }

    static getBadgeDetails(code: BadgeCode) {
        switch (code) {
            case 'road_warrior':
                return { name: "Road Warrior", description: "Logged 200+ miles of travel for fixtures.", icon: "Footprints", xp: 200 };
            case 'iron_track':
                return { name: "Iron Track", description: "Completed 10 consecutive confirmed appointments with zero cancellations.", icon: "ShieldCheck", xp: 500 };
            case 'early_bird':
                return { name: "Early Bird", description: "Checked in early for 20 matches.", icon: "Sunrise", xp: 150 };
            case 'top_rated_pro':
                return { name: "Top Rated Professional", description: "Maintained excellent post-match professionalism ratings across 25 matches.", icon: "Star", xp: 300 };
            case 'fixture_machine':
                return { name: "Fixture Machine", description: "Reached 50 completed appointments in a season.", icon: "Cog", xp: 400 };
            case 'local_legend':
                return { name: "Local Legend", description: "Completed 30 or more matches inside your registered county.", icon: "MapPin", xp: 250 };
            case 'mile_marker':
                return { name: "Mile Marker", description: "Completed 100 total verified match check-ins.", icon: "Milestone", xp: 500 };
            case 'whistle_scholar':
                return { name: "Whistle Scholar", description: "Completed all in-app training modules.", icon: "GraduationCap", xp: 300 };
            case 'community_champ':
                return { name: "Community Champ", description: "Officiated for 10 different clubs across the platform.", icon: "Users", xp: 200 };
            case 'tournament_titan':
                return { name: "Tournament Titan", description: "Participated in at least 3 full-day tournament events.", icon: "Trophy", xp: 400 };
            case 'seasoned_traveller':
                return { name: "Seasoned Traveller", description: "Officiated matches in 5+ different towns or postcodes.", icon: "Compass", xp: 200 };
            case 'consistency_king':
                return { name: "Consistency King", description: "Maintained over 90% appointment acceptance rate across a season.", icon: "Crown", xp: 350 };
            case 'rapid_responder':
                return { name: "Rapid Responder", description: "Accepted 20 match invitations within 10 minutes of being sent.", icon: "Zap", xp: 150 };
            case 'mentor_mode':
                return { name: "Mentor Mode", description: "Submitted 5+ post-match self-assessments or learning reflections.", icon: "BookOpen", xp: 200 };
            case 'golden_whistle':
                return { name: "Golden Whistle", description: "Season-long achievement for outstanding reliability and engagement.", icon: "Sparkles", xp: 1000 };
            case 'iron_man':
                return { name: "Iron Man", description: "Completed 5 consecutive bookings without cancellation", icon: "Shield", xp: 500 };
            case 'century_club':
                return { name: "Century Club", description: "Officiated 100 matches", icon: "Award", xp: 1000 };
            default:
                return null;
        }
    }
}
