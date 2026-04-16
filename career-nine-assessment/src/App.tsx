import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { DataProvider } from './contexts/DataContext'
import { AssessmentProvider } from './contexts/AssessmentContext'

import StudentLoginPage from './pages/StudentLoginPage'
import DemographicDetailsPage from './pages/DemographicDetailsPage'
import AllottedAssessmentPage from './pages/AllottedAssessmentPage'
import GeneralInstructionsPage from './pages/GeneralInstructionsPage'
import ThankYouPage from './pages/ThankYouPage'
import AssessmentRegisterPage from './pages/AssessmentRegisterPage'

const SelectSectionPage = lazy(() => import('./pages/SelectSectionPage'))
const SectionInstructionPage = lazy(() => import('./pages/SectionInstructionPage'))
const SectionQuestionPage = lazy(() => import('./pages/SectionQuestionPage'))

const LoadingSpinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
)

const RequireSession = ({ children }: { children: ReactNode }) => {
  const userStudentId = localStorage.getItem('userStudentId');
  if (!userStudentId) return <Navigate to="/student-login" replace />;
  return <>{children}</>;
};

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
          <h4>Something went wrong</h4>
          <p className="text-muted">The page failed to load. Please try again.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <AssessmentProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Navigate to="/student-login" replace />} />
                <Route path="/student-login" element={<StudentLoginPage />} />
                <Route path="/demographics/:assessmentId" element={<RequireSession><DemographicDetailsPage /></RequireSession>} />
                <Route path="/allotted-assessment" element={<RequireSession><AllottedAssessmentPage /></RequireSession>} />
                <Route path="/general-instructions" element={<RequireSession><GeneralInstructionsPage /></RequireSession>} />
                <Route path="/studentAssessment" element={<RequireSession><SelectSectionPage /></RequireSession>} />
                <Route path="/studentAssessment/sections/:sectionId" element={<RequireSession><SectionInstructionPage /></RequireSession>} />
                <Route path="/studentAssessment/sections/:sectionId/questions/:questionIndex" element={<RequireSession><SectionQuestionPage /></RequireSession>} />
                <Route path="/studentAssessment/completed" element={<RequireSession><ThankYouPage /></RequireSession>} />
                <Route path="/assessment-register/:token" element={<AssessmentRegisterPage />} />
                <Route path="*" element={<Navigate to="/student-login" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AssessmentProvider>
      </DataProvider>
    </BrowserRouter>
  )
}
