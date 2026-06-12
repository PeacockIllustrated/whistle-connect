'use client'

import Script from 'next/script'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useConsent } from './ConsentProvider'
import { GA_MEASUREMENT_ID } from '@/lib/consent/config'

// Sends a GA4 page_view on every client-side route change. Initial config uses
// send_page_view:false so this is the single source of page views (no dupes).
function PageViewTracker() {
    const { consent } = useConsent()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        if (consent !== 'granted' || typeof window.gtag !== 'function') return
        const qs = searchParams?.toString()
        window.gtag('event', 'page_view', {
            page_path: pathname + (qs ? `?${qs}` : ''),
            page_location: window.location.href,
            page_title: document.title,
        })
    }, [pathname, searchParams, consent])

    return null
}

/**
 * Consent-gated Google Analytics. Renders nothing — loads NO Google script and
 * sets NO cookie — until the user has opted in (`consent === 'granted'`). This is
 * the PECR-compliant "prior consent" gate.
 */
export function GoogleAnalytics() {
    const { consent } = useConsent()

    if (consent !== 'granted' || !GA_MEASUREMENT_ID) return null

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="wc-ga-init" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true,send_page_view:false});`}
            </Script>
            <Suspense fallback={null}>
                <PageViewTracker />
            </Suspense>
        </>
    )
}
