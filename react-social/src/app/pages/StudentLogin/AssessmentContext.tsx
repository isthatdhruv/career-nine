// AssessmentContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import assessmentApi from './API/assessmentApi';

type AssessmentContextType = {
  assessmentData: any;
  assessmentConfig: any;
  loading: boolean;
  error: string | null;
  fetchAssessmentData: (assessmentId: string) => Promise<void>;
};

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [assessmentConfig, setAssessmentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessmentData = async (assessmentId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    // Clear old assessment data before fetching new
    setAssessmentData(null);
    setAssessmentConfig(null);
    sessionStorage.removeItem('assessmentData');
    sessionStorage.removeItem('assessmentConfig');

    try {
      // Fetch both questionnaire data and assessment config in parallel
      // assessmentApi automatically injects session headers (X-Assessment-Session, etc.)
      const [questionnaireResponse, configResponse] = await Promise.allSettled([
        assessmentApi.get(`/assessments/getby/${assessmentId}`),
        assessmentApi.get(`/assessments/getById/${assessmentId}`),
      ]);

      if (questionnaireResponse.status === 'rejected') {
        throw new Error('Failed to fetch assessment data');
      }

      const data = questionnaireResponse.value.data;
      setAssessmentData(data);
      try {
        sessionStorage.setItem('assessmentData', JSON.stringify(data));
      } catch (e) {
        console.warn('Could not cache assessmentData to storage');
      }

      if (configResponse.status === 'fulfilled') {
        const configData = configResponse.value.data;
        setAssessmentConfig(configData);
        try {
          sessionStorage.setItem('assessmentConfig', JSON.stringify(configData));
        } catch (e) {
          console.warn('Could not cache assessmentConfig to storage');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching assessment data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
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
    <AssessmentContext.Provider value={{ assessmentData, assessmentConfig, loading, error, fetchAssessmentData }}>
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
