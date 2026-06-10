import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import http, { setCookieAuthRuntimeActive } from '../api/http';
import { getActiveCacheName } from '../components/ResourcePreloader';
import { sanitizePayload } from '../utils/sanitizeText';

type AssessmentContextType = {
  assessmentData: any;
  assessmentConfig: any;
  loading: boolean;
  error: string | null;
  fetchAssessmentData: (assessmentId: string) => Promise<void>;
  prefetchAssessmentData: (userStudentId: string) => void;
  preloadAssessmentData: (assessmentId: string) => void;
  prefetchedAssessments: any[] | null;
  /**
   * Phase 19 — mints the assessment-scoped cookie (cn_at_asmnt) by POSTing to
   * /auth/assessment-session once the (userStudentId, assessmentId) pair is
   * known. Returns true if the cookie path is now active, false if the SPA
   * fell back to the v2.0 header path (build flag off, 404 from per-institute
   * disabled, 403 enrolment mismatch, or transient network/5xx).
   *
   * Idempotent per `(userStudentId, assessmentId)` pair for the lifetime of
   * the SPA tab — repeat invocations for the same pair are no-ops. This
   * matches the plan's "pre-flight POST /auth/assessment-session once per
   * (userStudentId, assessmentId) pair" contract.
   */
  mintAssessmentSessionCookie: (userStudentId: number, assessmentId: number) => Promise<boolean>;
  /** True iff /auth/assessment-session returned 200 for the active pair. */
  cookieAuthActive: boolean;
  /**
   * Reset in-memory auth state so the next student login does not inherit the
   * prior student's mint cache. Called from /student-login.
   */
  resetAssessmentAuthState: () => void;
};

/**
 * Try loading a static JSON file from the build (public/assessment-cache/{id}/).
 * Checks the preloader's Cache API store first (instant, no network), then falls
 * back to a normal fetch. Returns null if neither works.
 */
async function tryStaticCache(assessmentId: string, file: string): Promise<any | null> {
  const url = `/assessment-cache/${assessmentId}/${file}`;
  try {
    // Check Cache API first (populated by ResourcePreloader)
    const cacheName = getActiveCacheName();
    if ('caches' in window && cacheName) {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(url);
      if (cached) return await cached.json();
    }
    // Fall back to network fetch
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {
    // Static file not available — fall through to API
  }
  return null;
}

/**
 * 3-tier fetch: Cache API → static build files → backend API.
 * Shared by prefetch, preload, and fetch paths to eliminate duplication.
 */
async function loadAssessmentById(assessmentId: string): Promise<{ data: any; config: any }> {
  const [staticData, staticConfig] = await Promise.all([
    tryStaticCache(assessmentId, 'data.json'),
    tryStaticCache(assessmentId, 'config.json'),
  ]);

  if (staticData && staticConfig) {
    // Static/cached files can be frozen copies built before the backend
    // mojibake fix — clean them here so no garbled char (â€™) ever renders.
    return { data: sanitizePayload(staticData), config: sanitizePayload(staticConfig) };
  }

  const [questionnaireRes, configRes] = await Promise.all([
    http.get(`/assessments/getby/${assessmentId}`),
    http.get(`/assessments/getById/${assessmentId}`),
  ]);
  return {
    data: sanitizePayload(questionnaireRes.data),
    config: sanitizePayload(configRes.data),
  };
}

/**
 * Persist assessment data + config to sessionStorage (non-critical).
 */
function cacheToSession(assessmentId: string, data: any, config: any) {
  try {
    sessionStorage.setItem('assessmentData', JSON.stringify(data));
    sessionStorage.setItem('assessmentConfig', JSON.stringify(config));
    sessionStorage.setItem('cachedAssessmentId', assessmentId);
  } catch {
    // Storage quota exceeded — non-critical
  }
}

/**
 * Module-level array keeps Image refs alive so the browser doesn't GC them.
 * Setting .src triggers background decode — zero manual work, Pentium-safe.
 */
const _preDecodedImages: HTMLImageElement[] = [];
let _lastDecodedDataRef: any = null;

function preDecodeOptionImages(data: any) {
  if (!data || !Array.isArray(data)) return;
  // Skip if we already decoded images for the exact same data reference
  if (data === _lastDecodedDataRef) return;
  _lastDecodedDataRef = data;
  // Release old image references to allow GC
  for (const img of _preDecodedImages) {
    img.src = '';
  }
  _preDecodedImages.length = 0;
  for (const q of data) {
    if (!q?.sections) continue;
    for (const sec of q.sections) {
      if (!sec?.questions) continue;
      for (const qq of sec.questions) {
        const opts = qq?.question?.options;
        if (!Array.isArray(opts)) continue;
        for (const opt of opts) {
          const b64 = opt?.optionImageBase64;
          if (!b64 || typeof b64 !== 'string' || b64.trim() === '') continue;
          const src = b64.startsWith('data:') ? b64
            : b64.startsWith('/') ? b64
            : `data:image/png;base64,${b64}`;
          const img = new Image();
          img.decoding = 'async';
          img.src = src;
          _preDecodedImages.push(img);
        }
      }
    }
  }
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assessmentData, _setAssessmentData] = useState<any>(null);
  const setAssessmentData = (data: any) => {
    _setAssessmentData(data);
    preDecodeOptionImages(data);
  };
  const [assessmentConfig, setAssessmentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetchedAssessments, setPrefetchedAssessments] = useState<any[] | null>(null);
  const prefetchingRef = useRef(false);
  const prefetchPromiseRef = useRef<Promise<void> | null>(null);
  const preloadPromiseRef = useRef<Promise<void> | null>(null);
  const cachedAssessmentIdRef = useRef<string | null>(null);

  /**
   * Phase 19 cookie-auth state.
   *
   * `cookieAuthActive` mirrors the http-instance runtime flag — it tracks
   * whether the most recent POST /auth/assessment-session for the active
   * pair returned 200. Components MAY branch UI on this (currently no
   * downstream consumer needs to; the SPA shows identical screens either
   * way) but the http-instance interceptor is the source of truth for
   * header-vs-cookie injection.
   *
   * `mintedPairRef` is the idempotency guard: we keep a string
   * `${userStudentId}:${assessmentId}` of the last successful mint so we
   * don't re-POST on every navigation. Cleared on logout / new pair.
   */
  const [cookieAuthActive, setCookieAuthActive] = useState<boolean>(false);
  const mintedPairRef = useRef<string | null>(null);
  const mintInFlightRef = useRef<Promise<boolean> | null>(null);

  /** Store fetched assessment data in context + sessionStorage */
  const applyAssessmentResult = (assessmentId: string, data: any, config: any) => {
    cachedAssessmentIdRef.current = assessmentId;
    setAssessmentData(data);
    setAssessmentConfig(config);
    cacheToSession(assessmentId, data, config);
  };

  const prefetchAssessmentData = (userStudentId: string) => {
    if (prefetchingRef.current || !userStudentId.trim()) return;
    prefetchingRef.current = true;

    // Only warm the public assessment-list endpoint here. The full assessment
    // payload (loadAssessmentById -> /assessments/getby/X + /assessments/getById/X)
    // requires the cn_at_asmnt cookie, which isn't minted until Start Assessment
    // is clicked. Loading it here on username-blur produced unauthenticated 401s.
    const promise = http.get(`/assessments/prefetch/${userStudentId}`)
      .then(({ data }) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setPrefetchedAssessments(sanitizePayload(data));
        }
      })
      .catch(() => {
        // Prefetch failure is non-critical
      })
      .finally(() => {
        prefetchingRef.current = false;
        prefetchPromiseRef.current = null;
      });
    prefetchPromiseRef.current = promise;
  };

  const preloadAssessmentData = (assessmentId: string) => {
    if (cachedAssessmentIdRef.current === assessmentId && assessmentData && assessmentConfig) return;
    if (preloadPromiseRef.current) return;

    const promise = (async () => {
      try {
        // If login-page prefetch is in flight, wait for it first
        if (prefetchPromiseRef.current) {
          await prefetchPromiseRef.current;
          if (cachedAssessmentIdRef.current === assessmentId) return;
        }

        const result = await loadAssessmentById(assessmentId);
        applyAssessmentResult(assessmentId, result.data, result.config);
      } catch {
        // Preload failure is non-critical — fetchAssessmentData will retry
      } finally {
        preloadPromiseRef.current = null;
      }
    })();
    preloadPromiseRef.current = promise;
  };

  /**
   * Mint cn_at_asmnt by POSTing to /auth/assessment-session.
   *
   * Decision matrix:
   *   - 200 OK → mark cookie auth active; cn_at_asmnt is the auth carrier
   *     for all subsequent /assessments/**, /assessment-answer/**, etc.
   *   - 404 (assessment_cookie_auth_not_enabled — per-institute or B2C
   *     rollout gate off on the server) → mark inactive; the SPA has no
   *     other auth carrier, so downstream calls will 401 and the response
   *     interceptor's /permission-denied redirect kicks in. Flip the
   *     server-side flag to roll cookie auth out for this institute / B2C.
   *   - 403 (enrolment or DOB mismatch) → mark inactive; downstream 403s
   *     map to "Your assessment session has expired."
   *   - Network or 5xx → mark inactive and let the calling page surface
   *     the failure; warn to console for ops visibility.
   *
   * Idempotent per (userStudentId, assessmentId) pair; concurrent callers
   * coalesce via mintInFlightRef.
   */
  const mintAssessmentSessionCookie = async (
    userStudentId: number,
    assessmentId: number,
  ): Promise<boolean> => {
    console.log('[ASSESS-SESSION-DEBUG] mint() ENTRY userStudentId=' + userStudentId
      + ' assessmentId=' + assessmentId
      + ' alreadyMintedPair=' + mintedPairRef.current
      + ' inFlight=' + !!mintInFlightRef.current);

    // The build-time COOKIE_AUTH_FLAG gate used to short-circuit here so a
    // legacy X-Assessment-Session header path could carry auth instead. That
    // header fallback was removed (see comment in src/api/http.ts), which left
    // the SPA with no auth carrier whenever the flag was false — every
    // authenticated request 401s. Mint is now always attempted; the per-
    // institute / B2C rollout gate lives on the server (returns 404
    // assessment_cookie_auth_not_enabled when off).

    const pairKey = `${userStudentId}:${assessmentId}`;
    if (mintedPairRef.current === pairKey) {
      console.log('[ASSESS-SESSION-DEBUG] mint() SKIP already-minted-this-tab pairKey=' + pairKey);
      // Already minted for this exact pair in this tab — http-instance flag
      // is already set; nothing to do.
      return cookieAuthActive;
    }
    if (mintInFlightRef.current) {
      console.log('[ASSESS-SESSION-DEBUG] mint() JOIN in-flight pairKey=' + pairKey);
      // Coalesce concurrent callers (e.g. AllottedAssessmentPage + an effect)
      return mintInFlightRef.current;
    }

    const mintPromise = (async () => {
      try {
        const dob = localStorage.getItem('studentDob');
        if (!dob) {
          console.log('[ASSESS-SESSION-DEBUG] mint() FAIL no-dob-in-localStorage pairKey=' + pairKey);
          // No DOB cached (e.g. tab opened after a stale-storage flush) — the
          // backend's @NotNull dob field would 400 the request. Fall back to
          // the legacy header path; the student keeps working without being
          // bounced to login.
          setCookieAuthRuntimeActive(false);
          setCookieAuthActive(false);
          return false;
        }
        console.log('[ASSESS-SESSION-DEBUG] mint() POST /auth/assessment-session pairKey=' + pairKey);
        await http.post('/auth/assessment-session', { userStudentId, assessmentId, dob });
        mintedPairRef.current = pairKey;
        setCookieAuthRuntimeActive(true);
        setCookieAuthActive(true);
        console.log('[ASSESS-SESSION-DEBUG] mint() SUCCESS pairKey=' + pairKey
          + ' cookies=' + (typeof document !== 'undefined' ? document.cookie : 'n/a'));
        return true;
      } catch (err: any) {
        const status = err?.response?.status;
        console.log('[ASSESS-SESSION-DEBUG] mint() ERROR pairKey=' + pairKey
          + ' status=' + (status ?? 'no-response')
          + ' msg=' + (err?.message ?? 'n/a'));
        if (status === 404) {
          console.log('[ASSESS-SESSION-DEBUG] mint() FALLBACK institute-flag-off pairKey=' + pairKey);
          // Per-institute flag OFF — fall back transparently.
          setCookieAuthRuntimeActive(false);
          setCookieAuthActive(false);
          return false;
        }
        if (status === 403) {
          console.log('[ASSESS-SESSION-DEBUG] mint() FALLBACK enrolment-or-dob-mismatch pairKey=' + pairKey);
          // Enrolment mismatch — fall back; downstream 403 will re-tokenize.
          setCookieAuthRuntimeActive(false);
          setCookieAuthActive(false);
          return false;
        }
        console.log('[ASSESS-SESSION-DEBUG] mint() FALLBACK network-or-5xx pairKey=' + pairKey);
        // Network or 5xx — fall back so the student is not blocked.
        // eslint-disable-next-line no-console
        console.warn('mintAssessmentSessionCookie failed; falling back to header path', err);
        setCookieAuthRuntimeActive(false);
        setCookieAuthActive(false);
        return false;
      } finally {
        mintInFlightRef.current = null;
      }
    })();
    mintInFlightRef.current = mintPromise;
    return mintPromise;
  };

  const resetAssessmentAuthState = () => {
    mintedPairRef.current = null;
    mintInFlightRef.current = null;
    setCookieAuthActive(false);
  };

  const fetchAssessmentData = async (assessmentId: string): Promise<void> => {
    // Wait for any in-flight prefetch or preload to complete first
    if (prefetchPromiseRef.current) {
      await prefetchPromiseRef.current;
    }
    if (preloadPromiseRef.current) {
      await preloadPromiseRef.current;
    }
    // Only use cached data if it matches the requested assessmentId
    if (assessmentData && assessmentConfig && cachedAssessmentIdRef.current === assessmentId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await loadAssessmentById(assessmentId);
      applyAssessmentResult(assessmentId, result.data, result.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching assessment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedId = sessionStorage.getItem('cachedAssessmentId');
    if (storedId) {
      cachedAssessmentIdRef.current = storedId;
    }

    const stored = sessionStorage.getItem('assessmentData');
    if (stored) {
      try {
        setAssessmentData(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored assessment data, clearing corrupted entry');
        sessionStorage.removeItem('assessmentData');
        sessionStorage.removeItem('cachedAssessmentId');
      }
    }

    const storedConfig = sessionStorage.getItem('assessmentConfig');
    if (storedConfig) {
      try {
        setAssessmentConfig(JSON.parse(storedConfig));
      } catch (e) {
        console.error('Failed to parse stored assessment config, clearing corrupted entry');
        sessionStorage.removeItem('assessmentConfig');
        sessionStorage.removeItem('cachedAssessmentId');
      }
    }
  }, []);

  return (
    <AssessmentContext.Provider value={{
      assessmentData, assessmentConfig, loading, error,
      fetchAssessmentData, prefetchAssessmentData, preloadAssessmentData, prefetchedAssessments,
      mintAssessmentSessionCookie, cookieAuthActive, resetAssessmentAuthState,
    }}>
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within AssessmentProvider');
  }
  return context;
};
