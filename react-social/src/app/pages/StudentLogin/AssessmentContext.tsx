// AssessmentContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

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
      const API_URL = process.env.REACT_APP_API_URL;

      // Fetch both questionnaire data and assessment config in parallel
      const [questionnaireResponse, configResponse] = await Promise.all([
        fetch(`${API_URL}/assessments/getby/${assessmentId}`),
        fetch(`${API_URL}/assessments/getById/${assessmentId}`),
      ]);

      if (!questionnaireResponse.ok) {
        throw new Error('Failed to fetch assessment data');
      }

      const data = await questionnaireResponse.json();
      setAssessmentData(data);
      localStorage.setItem('assessmentData', JSON.stringify(data));

      if (configResponse.ok) {
        const configData = await configResponse.json();
        setAssessmentConfig(configData);
        localStorage.setItem('assessmentConfig', JSON.stringify(configData));
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
