import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      // Service worker: must be served uncached at root scope for push to work in background
      {
        source: "/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            value: "max-age=0, no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      // Global security headers
      {
        source: "/(.*)",
        headers: [
          {
            // Content-Security-Policy. Deliberately permissive on script/style
            // (Next.js injects un-nonced inline bootstrap + styled-jsx) and broad
            // on connect/img (https:/wss:) so no third-party endpoint —
            // Supabase realtime, Stripe, Mapbox tiles, the Sentry /monitoring
            // tunnel — can be silently blocked. It still meaningfully hardens:
            // object-src none, base-uri self, form-action self, frame-ancestors
            // none (defence-in-depth alongside X-Frame-Options), and an explicit
            // Stripe frame allowlist. Flip to Content-Security-Policy-Report-Only
            // if a future change needs to observe violations before enforcing.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
              "media-src 'self'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// Sentry build-time wrapper. Uploads source maps when SENTRY_AUTH_TOKEN is
// set (CI / production builds), tunnels Sentry events through /monitoring
// to bypass ad-blockers, and configures the Next.js plugin.
//
// If Sentry env vars are missing (local dev without Sentry), the wrapper
// no-ops and you get a vanilla Next.js build.
export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG || "whistle-connect",
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Route Sentry beacons through your domain — bypasses ad-blockers that
    // would otherwise drop the events client-side.
    tunnelRoute: "/monitoring",

    // Quiet the build output unless we're in CI.
    silent: !process.env.CI,

    // Don't fail the build if Sentry CLI auth fails (missing token in dev).
    // Production builds via Vercel CI will have the token, dev builds skip.
    sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
    },
});
