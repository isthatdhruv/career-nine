import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import http from '../api/http';

type AssessmentContextType = {
  assessmentData: any;
  assessmentConfig: any;
  loading: boolean;
  error: string | null;
  fetchAssessmentData: (assessmentId: string) => Promise<void>;
  prefetchAssessmentData: (userStudentId: string) => void;
  prefetchedAssessments: any[] | null;
};

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [assessmentConfig, setAssessmentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetchedAssessments, setPrefetchedAssessments] = useState<any[] | null>(null);
  const prefetchingRef = useRef(false);

  const prefetchAssessmentData = (userStudentId: string) => {
    if (prefetchingRef.current || !userStudentId.trim()) return;
    prefetchingRef.current = true;

    http.get(`/assessments/prefetch/${userStudentId}`)
      .then(({ data }) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setPrefetchedAssessments(data);
          // Also prefetch the full questionnaire data for the first active assessment
          const firstActive = data.find((a: any) => a.isActive && a.questionnaireId);
          if (firstActive) {
            Promise.all([
              http.get(`/assessments/getby/${firstActive.assessmentId}`),
              http.get(`/assessments/getById/${firstActive.assessmentId}`),
            ]).then(([questionnaireRes, configRes]) => {
              // Pre-store in localStorage so SectionQuestionPage can use it
              localStorage.setItem('assessmentData', JSON.stringify(questionnaireRes.data));
              localStorage.setItem('assessmentConfig', JSON.stringify(configRes.data));
              setAssessmentData(questionnaireRes.data);
              setAssessmentConfig(configRes.data);
            }).catch(() => {
              // Prefetch failure is non-critical
            });
          }
        }
      })
      .catch(() => {
        // Prefetch failure is non-critical
      })
      .finally(() => {
        prefetchingRef.current = false;
      });
  };

  const fetchAssessmentData = async (assessmentId: string): Promise<void> => {
    // If data was already prefetched, skip the API call
    if (assessmentData && assessmentConfig) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [questionnaireRes, configRes] = await Promise.all([
        http.get(`/assessments/getby/${assessmentId}`),
        http.get(`/assessments/getById/${assessmentId}`),
      ]);

      setAssessmentData(questionnaireRes.data);
      localStorage.setItem('assessmentData', JSON.stringify(questionnaireRes.data));

      setAssessmentConfig(configRes.data);
      localStorage.setItem('assessmentConfig', JSON.stringify(configRes.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching assessment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('assessmentData');
    if (stored) {
      try {
        setAssessmentData(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored assessment data');
      }
    }

    const storedConfig = localStorage.getItem('assessmentConfig');
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
      fetchAssessmentData, prefetchAssessmentData, prefetchedAssessments
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
