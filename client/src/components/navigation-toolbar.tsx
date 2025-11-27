import { Link, useLocation } from "wouter";
import { Home, Shield, Flag, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";

export function NavigationToolbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [location] = useLocation();

    const toggleOpen = () => setIsOpen(!isOpen);

    const navItems = [
        { href: "/", icon: Home, label: "Home" },
        { href: "/auth/coach", icon: Shield, label: "Coach Auth" },
        { href: "/auth/referee", icon: Flag, label: "Ref Auth" },
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ];

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
            {isOpen && (
                <div className="bg-card border border-border rounded-lg shadow-2xl p-2 flex flex-col gap-1 animate-in slide-in-from-bottom-5 fade-in duration-200 mb-2">
                    {navItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                            <div
                                className={`flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors ${location === item.href
                                    ? "bg-primary/20 text-primary font-bold"
                                    : "hover:bg-muted text-muted-foreground hover:text-white"
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span className="text-sm uppercase tracking-wider">{item.label}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <button
                onClick={toggleOpen}
                className="h-12 w-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
        </div>
    );
}
