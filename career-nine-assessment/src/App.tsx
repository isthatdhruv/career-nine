import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { DataProvider } from './contexts/DataContext'
import { AssessmentProvider } from './contexts/AssessmentContext'

import StudentLoginPage from './pages/StudentLoginPage'
import DemographicDetailsPage from './pages/DemographicDetailsPage'
import AllottedAssessmentPage from './pages/AllottedAssessmentPage'
import GeneralInstructionsPage from './pages/GeneralInstructionsPage'
import ThankYouPage from './pages/ThankYouPage'
import AssessmentRegisterPage from './pages/AssessmentRegisterPage'
import AssessmentUpgradePage from './pages/AssessmentUpgradePage'
import SchoolAssessmentRegisterPage from './pages/SchoolAssessmentRegisterPage'
import PaymentStatusPage from './pages/PaymentStatusPage'
import CampaignRegisterPage from './pages/CampaignRegisterPage'
import PayForReportPage from './pages/PayForReportPage'
import AssessmentStartPage from './pages/AssessmentStartPage'
import PermissionDeniedPage from './components/PermissionDeniedPage'

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
      <ToastContainer />
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
              <Route path="/assessment-upgrade/:entitlementId" element={<AssessmentUpgradePage />} />
              <Route path="/school-register/:token" element={<SchoolAssessmentRegisterPage />} />
              <Route path="/assessment/start" element={<AssessmentStartPage />} />
              <Route path="/payment-status" element={<PaymentStatusPage />} />
              <Route path="/c/:slug" element={<CampaignRegisterPage />} />
              <Route path="/c/:slug/:assessmentId" element={<CampaignRegisterPage />} />
              <Route path="/c/:slug/:assessmentId/upgrade/:entitlementId" element={<PayForReportPage />} />
              <Route path="/c/:slug/:assessmentId/:tierId" element={<CampaignRegisterPage />} />
              {/*
                Phase 19 (Plan 19-05): assessment SPA permission-denied page.
                Mounted BEFORE the wildcard so /permission-denied does not get
                swallowed by the redirect-to-student-login fallback. The http.ts
                response interceptor redirects here on 403 (and on 401 when
                cookieAuthRuntimeActive is true, i.e. cn_at_asmnt is the active
                auth mechanism).
              */}
              <Route path="/permission-denied" element={<PermissionDeniedPage />} />
              <Route path="*" element={<Navigate to="/student-login" replace />} />
            </Routes>
          </Suspense>
        </AssessmentProvider>
      </DataProvider>
    </BrowserRouter>
  )
}
