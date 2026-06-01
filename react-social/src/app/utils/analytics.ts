// Thin wrapper around the GA4 gtag() that is loaded in public/index.html.
//
// Use this for browser-side funnel events (e.g. a registration completing or a
// buyer being sent to the payment page). The authoritative "purchase"
// conversion is fired server-side from the Razorpay webhook, because the buyer
// may never return to the site after paying — so do NOT rely on a browser
// event for revenue/conversion counts.
//
// Safe no-op if GA isn't available (not loaded yet, blocked by an ad-blocker,
// SSR, etc.) — analytics must never break the app.

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  } catch {
    // swallow — analytics is best-effort
  }
}

export {};
