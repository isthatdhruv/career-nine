import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
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

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <AssessmentProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Navigate to="/student-login" replace />} />
              <Route path="/student-login" element={<StudentLoginPage />} />
              <Route path="/demographics/:assessmentId" element={<DemographicDetailsPage />} />
              <Route path="/allotted-assessment" element={<AllottedAssessmentPage />} />
              <Route path="/general-instructions" element={<GeneralInstructionsPage />} />
              <Route path="/studentAssessment" element={<SelectSectionPage />} />
              <Route path="/studentAssessment/sections/:sectionId" element={<SectionInstructionPage />} />
              <Route path="/studentAssessment/sections/:sectionId/questions/:questionIndex" element={<SectionQuestionPage />} />
              <Route path="/studentAssessment/completed" element={<ThankYouPage />} />
              <Route path="/assessment-register/:token" element={<AssessmentRegisterPage />} />
            </Routes>
          </Suspense>
        </AssessmentProvider>
      </DataProvider>
    </BrowserRouter>
  )
}
