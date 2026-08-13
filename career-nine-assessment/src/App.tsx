import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { DataProvider } from './contexts/DataContext'
import { AssessmentProvider } from './contexts/AssessmentContext'
import AppErrorBoundary from './components/AppErrorBoundary'

import StudentLoginPage from './pages/StudentLoginPage'
import DemographicDetailsPage from './pages/DemographicDetailsPage'
import AllottedAssessmentPage from './pages/AllottedAssessmentPage'
import GeneralInstructionsPage from './pages/GeneralInstructionsPage'
import ThankYouPage from './pages/ThankYouPage'
import AssessmentRegisterPage from './pages/AssessmentRegisterPage'
import AssessmentInviteRegisterPage from './pages/AssessmentInviteRegisterPage'
import CounsellingRescheduleUpdatePage from './pages/CounsellingRescheduleUpdatePage'
import AssessmentUpgradePage from './pages/AssessmentUpgradePage'
import SchoolAssessmentRegisterPage from './pages/SchoolAssessmentRegisterPage'
import PaymentStatusPage from './pages/PaymentStatusPage'
import CampaignRegisterPage from './pages/CampaignRegisterPage'
import PayForReportPage from './pages/PayForReportPage'
import AssessmentStartPage from './pages/AssessmentStartPage'
import PermissionDeniedPage from './components/PermissionDeniedPage'

/*
  DELIBERATELY STATIC — do not convert these back to React.lazy().

  These three pages used to be the only code-split routes in the app, and they
  were the direct cause of the long-standing "/studentAssessment forces every
  student to reload" bug:

    - Each build emits one hash per chunk and wipes dist/, and the static host
      is configured with `catchall_document: index.html` (.do/app.yaml). So a
      chunk URL from a previous build does not 404 — it returns 200 with
      Content-Type: text/html, and the browser refuses it with "Failed to load
      module script". Retrying is futile; the response is deterministic.
    - The service worker (before vite.config.ts was fixed) swapped builds under
      already-open tabs, which made exactly that happen on every deploy.
    - <Suspense> had no error boundary, so the rejected lazy() promise unmounted
      the React root: dead page, no message, manual reload the only way out.

  Splitting them was never worth it anyway. Together they are ~56 KB gzip that
  100% of students need within a minute of logging in, while ResourcePreloader
  already blocks app boot behind multi-MB of precached assets. Deferring
  non-conditional code just moves those bytes to a worse moment — the start of
  the exam, on venue WiFi — and buys a hard network dependency there.

  Genuinely conditional code (the game bundles, firebase, webgazer) is still
  lazy; see games/GameRenderer.tsx.
*/
import SelectSectionPage from './pages/SelectSectionPage'
import SectionInstructionPage from './pages/SectionInstructionPage'
import SectionQuestionPage from './pages/SectionQuestionPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <DataProvider>
        <AssessmentProvider>
          <AppErrorBoundary>
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
              <Route path="/assessment-invite/:token" element={<AssessmentInviteRegisterPage />} />
              <Route path="/counselling-reschedule/:token" element={<CounsellingRescheduleUpdatePage />} />
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
          </AppErrorBoundary>
        </AssessmentProvider>
      </DataProvider>
    </BrowserRouter>
  )
}
