import { Link } from "wouter";
import { Shield, Flag, ArrowRight } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden relative">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <header className="p-6 z-10">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex flex-col">
                        <h1 className="font-heading text-2xl font-bold text-white uppercase tracking-tight italic">Whistle Connect</h1>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">FA Referee Management</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative">
                <div className="text-center mb-12 max-w-2xl">
                    <h2 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6 uppercase tracking-tight">
                        Elevate Your <span className="text-primary italic">Game</span>
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        The professional platform connecting grassroots coaches with qualified FA referees.
                        Seamless booking, instant communication, and reliable match management.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                    {/* Coach Card */}
                    <Link href="/auth/coach">
                        <div className="group relative bg-card border border-border hover:border-primary/50 p-8 rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(22,163,74,0.3)] hover:-translate-y-1 cursor-pointer overflow-hidden h-full flex flex-col">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                            <div className="mb-6 relative">
                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors rotate-3 group-hover:rotate-6 duration-300">
                                    <Shield className="w-8 h-8 text-primary" />
                                </div>
                            </div>

                            <h3 className="font-heading text-2xl font-bold text-white mb-2 uppercase">I am a Coach</h3>
                            <p className="text-muted-foreground mb-8 flex-1">
                                Find qualified referees for your matches. Manage bookings, view availability, and ensure your game day runs smoothly.
                            </p>

                            <div className="flex items-center text-primary font-bold uppercase tracking-wider text-sm group-hover:gap-2 transition-all">
                                <span>Coach Access</span>
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* Referee Card */}
                    <Link href="/auth/referee">
                        <div className="group relative bg-card border border-border hover:border-secondary/50 p-8 rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(250,204,21,0.2)] hover:-translate-y-1 cursor-pointer overflow-hidden h-full flex flex-col">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                            <div className="mb-6 relative">
                                <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center group-hover:bg-secondary/20 transition-colors -rotate-3 group-hover:-rotate-6 duration-300">
                                    <Flag className="w-8 h-8 text-secondary" />
                                </div>
                            </div>

                            <h3 className="font-heading text-2xl font-bold text-white mb-2 uppercase">I am a Referee</h3>
                            <p className="text-muted-foreground mb-8 flex-1">
                                Manage your availability, accept match requests, and track your officiating career. Get paid and progress your level.
                            </p>

                            <div className="flex items-center text-secondary font-bold uppercase tracking-wider text-sm group-hover:gap-2 transition-all">
                                <span>Referee Portal</span>
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-6 text-center z-10">
                <p className="text-xs text-muted-foreground uppercase tracking-widest opacity-50">
                    © 2025 Whistle Connect • Professional Standard
                </p>
            </footer>
        </div>
    );
}
