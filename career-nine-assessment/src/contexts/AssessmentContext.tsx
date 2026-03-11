import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import http from '../api/http';
import { getActiveCacheName } from '../components/ResourcePreloader';

type AssessmentContextType = {
  assessmentData: any;
  assessmentConfig: any;
  loading: boolean;
  error: string | null;
  fetchAssessmentData: (assessmentId: string) => Promise<void>;
  prefetchAssessmentData: (userStudentId: string) => void;
  preloadAssessmentData: (assessmentId: string) => void;
  prefetchedAssessments: any[] | null;
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
    return { data: staticData, config: staticConfig };
  }

  const [questionnaireRes, configRes] = await Promise.all([
    http.get(`/assessments/getby/${assessmentId}`),
    http.get(`/assessments/getById/${assessmentId}`),
  ]);
  return { data: questionnaireRes.data, config: configRes.data };
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

    const promise = http.get(`/assessments/prefetch/${userStudentId}`)
      .then(async ({ data }) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setPrefetchedAssessments(data);
          const firstActive = data.find((a: any) => a.isActive && a.questionnaireId);
          if (firstActive) {
            try {
              const aid = String(firstActive.assessmentId);
              const result = await loadAssessmentById(aid);
              applyAssessmentResult(aid, result.data, result.config);
            } catch {
              // Prefetch failure is non-critical
            }
          }
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
        console.error('Failed to parse stored assessment data');
      }
    }

    const storedConfig = sessionStorage.getItem('assessmentConfig');
    if (storedConfig) {
      try {
        setAssessmentConfig(JSON.parse(storedConfig));
      } catch (e) {
        console.error('Failed to parse stored assessment config');
      }
    }
  }, []);

  return (
    <AssessmentContext.Provider value={{
      assessmentData, assessmentConfig, loading, error,
      fetchAssessmentData, prefetchAssessmentData, preloadAssessmentData, prefetchedAssessments
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
