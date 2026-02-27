import React, { createContext, useContext, useState, useEffect } from 'react';
import http from '../api/http';

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

    try {
      const [questionnaireRes, configRes] = await Promise.all([
        http.get(`/assessments/getby/${assessmentId}`),
        http.get(`/assessments/getById/${assessmentId}`),
      ]);

      setAssessmentData(questionnaireRes.data);
      try {
        sessionStorage.setItem('assessmentData', JSON.stringify(questionnaireRes.data));
      } catch (e) {
        console.warn('Could not cache assessmentData to storage');
      }

      setAssessmentConfig(configRes.data);
      try {
        sessionStorage.setItem('assessmentConfig', JSON.stringify(configRes.data));
      } catch (e) {
        console.warn('Could not cache assessmentConfig to storage');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching assessment data:', err);
    } finally {
      setLoading(false);
    }
  };

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
