import { Link } from "wouter";

export default function NotFound() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-heading font-bold text-primary">404</h1>
                <p className="text-muted-foreground">Page not found</p>
                <Link href="/">
                    <a className="btn-cyber bg-primary text-primary-foreground px-8 py-3 inline-block no-underline">
                        <span className="btn-cyber-content">Return Home</span>
                    </a>
                </Link>
            </div>
        </div>
    );
}
