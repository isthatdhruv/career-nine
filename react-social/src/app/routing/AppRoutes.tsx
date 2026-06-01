/**
 * High level router.
 *
 * Note: It's recommended to compose related routes in internal router
 * components (e.g: `src/app/modules/Auth/pages/AuthPage`, `src/app/BasePage`).
 */

import { FC, lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import TopBarProgress from "react-topbar-progress-indicator";
import { getCSSVariableValue } from "../../_metronic/assets/ts/_utils";
import { WithChildren } from "../../_metronic/helpers";
import { AuthRedirectPage } from "../../app/pages/authRedirectPage";
import { App } from "../App";
import { AuthPage, Logout, useAuth } from "../modules/auth";
import { ErrorsPage } from "../modules/errors/ErrorsPage";
import FacultyRegistrationForm from "../pages/FacultyRegistration/FacultyRegistrationForm";
import StudentDetailPage from "../pages/StudentRegistration/StudentRegistrationForm";
import { ThankYouPage } from "../pages/StudentRegistration/ThankYou";
import { UniRollNoUpdate } from "../pages/StudentRegistration/UniRollNoUpdate";
import { PrivateRoutes } from "./PrivateRoutes";
import CounsellorRoutes from "./CounsellorRoutes";
// import CompilerPageEdit from "../pages/Compiler/compilerEdit";
import PrincipalDashboard from "../pages/PrincipalDashboard/PrincipalDashboard";
import { MasterLayout } from "../../_metronic/layout/MasterLayout";

const ExternalRedirect: FC<{ to: string }> = ({ to }) => {
  useEffect(() => {
    window.location.href = to;
  }, [to]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};

const AssessmentRegisterRedirect: FC = () => {
  const { token } = useParams<{ token: string }>();
  useEffect(() => {
    const target = `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}${window.location.search}`;
    window.location.replace(target);
  }, [token]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};

const PaymentStatusRedirect: FC = () => {
  useEffect(() => {
    const target = `${process.env.REACT_APP_ASSESSMENT_APP_URL}/payment-status${window.location.search}`;
    window.location.replace(target);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};

const CampaignLandingRedirect: FC = () => {
  const params = useParams<{ slug?: string; assessmentId?: string; tierId?: string }>();
  useEffect(() => {
    let path = `/c/${params.slug ?? ""}`;
    if (params.assessmentId) path += `/${params.assessmentId}`;
    if (params.tierId) path += `/${params.tierId}`;
    const target = `${process.env.REACT_APP_ASSESSMENT_APP_URL}${path}${window.location.search}`;
    window.location.replace(target);
  }, [params.slug, params.assessmentId, params.tierId]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};

const SchoolAssessmentRegisterPage = lazy(
  () => import("../pages/SchoolRegistration/SchoolAssessmentRegisterPage")
);
const PaymentRegisterPage = lazy(
  () => import("../pages/PaymentTracking/PaymentRegisterPage")
);

const StudentRegistrationForm = lazy(
  () => import("../pages/StudentRegistration/StudentRegistrationForm")
);
const StudentRegistrationFormExisting = lazy(
  () => import("../pages/StudentRegistration/StudentRegistrationExisting")
);
const ReFillFormPage = lazy(
  () => import("../pages/StudentRegistration/ReFillFormPage")
);
const FacultyReFillFormPage = lazy(
  () => import("../pages/FacultyRegistration/ReFillFormPage")
);
const ClassRoomPage = lazy(
  () => import("../pages/ClassRoom/ClassRoom")
);
const PermissionDeniedPage = lazy(
  () => import("../components/PermissionDeniedPage")
);
const SchoolDashboardPage = lazy(
  () => import("../pages/Dashboards/SchoolDashboardPage")
);
const SchoolNavigatorDashboardPage = lazy(
  () => import("../pages/Dashboards/SchoolNavigatorDashboardPage")
);
const SchoolCombinedDashboardPage = lazy(
  () => import("../pages/Dashboards/SchoolCombinedDashboardPage")
);

/**
 * Base URL of the website.
 *
 * @see https://facebook.github.io/create-react-app/docs/using-the-public-folder
 */
const { PUBLIC_URL } = process.env;

const AppRoutes: FC = () => {
  const { currentUser } = useAuth();

  return (
    <Routes>
      {/* Role Portals — standalone layout, no Metronic MasterLayout */}
      <Route path="/counsellor/*" element={<CounsellorRoutes />} />

      {/* Public, standalone School Dashboard — no auth, no Metronic layout, not in aside menu */}
      <Route
        path="/school/dashboard"
        element={
          <SuspensedView>
            <SchoolDashboardPage />
          </SuspensedView>
        }
      />
      <Route
        path="/school/navigator-dashboard"
        element={
          <SuspensedView>
            <SchoolNavigatorDashboardPage />
          </SuspensedView>
        }
      />
      <Route
        path="/school/combined-dashboard"
        element={
          <SuspensedView>
            <SchoolCombinedDashboardPage />
          </SuspensedView>
        }
      />

      <Route element={<App />}>
        <Route path="/student-details" element={<StudentDetailPage />} />
        <Route path="/oauth2/redirect" element={<AuthRedirectPage />} />
        <Route path="error/*" element={<ErrorsPage />} />
        {/*
          Phase 19 (Plan 19-05): canonical admin/staff permission-denied page.
          Mounted BEFORE the auth-conditional catch-all so both authenticated
          and unauthenticated users can reach it (an unauthenticated 403 from
          a deeplink should land here, not bounce to /auth).
          Student / counsellor variants live inside their own route trees
          (/student/permission-denied, /counsellor/permission-denied) so the
          persona layout stays consistent.
        */}
        <Route
          path="/permission-denied"
          element={
            <SuspensedView>
              <PermissionDeniedPage />
            </SuspensedView>
          }
        />
        
        {/* <Route path="compiler/compiler-edit" element={<CompilerPageEdit />} /> */}
        <Route
          path="/thankyou"
          element={
            <SuspensedView>
              <ThankYouPage />
            </SuspensedView>
          }
        />
        <Route element={<MasterLayout />}>
          <Route
            path="/principal/dashboard"
            element={
              <SuspensedView>
                <PrincipalDashboard />
              </SuspensedView>
            }
          />
        </Route>
        <Route
        path="/student/registration-form"
        element={
          <SuspensedView>
            <StudentRegistrationForm />
          </SuspensedView>
        }
      />
      <Route
        path="/student/registration-existing"
        element={
          <SuspensedView>
            <StudentRegistrationFormExisting />
          </SuspensedView>
        }
      />
     
            <Route
              path="/allotted-assessment"
              element={<ExternalRedirect to="https://assessment.career-9.com/" />}
            />
            <Route
              path="/demographics/:assessmentId"
              element={<ExternalRedirect to="https://assessment.career-9.com/" />}
            />
            <Route
              path="/demographics"
              element={<ExternalRedirect to="https://assessment.career-9.com/" />}
            />
            <Route
              path="/studentAssessment/completed"
              element={<ExternalRedirect to="https://assessment.career-9.com/" />}
            />
      <Route
              path="/student-login"
              element={<ExternalRedirect to="https://assessment.career-9.com/" />}
            />
      <Route
              path="/assessment-register/:token"
              element={<AssessmentRegisterRedirect />}
            />
      <Route
              path="/school-register/:token"
              element={
                <SuspensedView>
                  <SchoolAssessmentRegisterPage />
                </SuspensedView>
              }
            />
      <Route
              path="/payment-status"
              element={<PaymentStatusRedirect />}
            />
      <Route
              path="/c/:slug"
              element={<CampaignLandingRedirect />}
            />
      <Route
              path="/c/:slug/:assessmentId"
              element={<CampaignLandingRedirect />}
            />
      <Route
              path="/c/:slug/:assessmentId/:tierId"
              element={<CampaignLandingRedirect />}
            />
      <Route
              path="/payment-register/:transactionId"
              element={
                <SuspensedView>
                  <PaymentRegisterPage />
                </SuspensedView>
              }
            />
      {/* <Route path="/questionaire/List" element={
        <SuspensedView>
          <QuestionaireListPage />
        </SuspensedView>
      } /> */}
      <Route
        path="/faculty/registration-form"
        element={
          <SuspensedView>
            <FacultyRegistrationForm />
          </SuspensedView>
        }
      />
      <Route
        path="/re-fillForm/*"
        element={
          <SuspensedView>
            <ReFillFormPage/>
          </SuspensedView>
        }
      />
      <Route
        path="/student/uni-roll-no/update"
        element={
          <SuspensedView>
           <UniRollNoUpdate/>
          </SuspensedView>
        }
      />
        
        <Route  path="/student/registration-form"
          element={
            <SuspensedView>
              <StudentRegistrationForm />
            </SuspensedView>
          }
        />
        <Route
          path="/faculty/registration-form"
          element={
            <SuspensedView>
              <FacultyRegistrationForm />
            </SuspensedView>
          }
        />
        <Route
          path="/re-fillForm/*"
          element={
            <SuspensedView>
              <ReFillFormPage />
            </SuspensedView>
          }
        />
        <Route
          path="faculty/re-fillForm/*"
          element={
            <SuspensedView>
              <FacultyReFillFormPage />
            </SuspensedView>
          }
        />
        <Route
          path="classroom/*"
          element={
            <SuspensedView>
              <ClassRoomPage/>
            </SuspensedView>
          }
        />
       

        <Route path="logout" element={<Logout />} />

        <Route path="registrar/logout" element={<Logout />} />

        <Route path="student/logout" element={<Logout />} />

        <Route path="faculty/logout" element={<Logout />} />

        <Route path="roles/logout" element={<Logout />} />

        {/* <>
            <Route path="/*" element={<PrivateRoutes />} />
            <Route index element={<Navigate to="/dashboard" />} />
          </> */}

        {currentUser ? (
          <>
            <Route path="/*" element={<PrivateRoutes />} />
            <Route index element={<Navigate to="/dashboard" />} />
          </>
        ) : (
          <>
            <Route path="auth/*" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/auth" />} />
          </>
        )
        }

        {/* {currentUser ? (
          roles && roles!.lastIndexOf("/temp-student") === -1 ?
            <>
              <Route path="/*" element={<PrivateRoutes />} />
              <Route index element={<Navigate to="/dashboard" />} />
            </>
            : <>
              <Route path="auth/*" element={<ErrorsPage />} />
            </>
        ) : (<>
          <Route path="auth/*" element={<AuthPage />} />
        </>
        )} */}
      </Route>
    </Routes>
  );
};

const SuspensedView: FC<WithChildren> = ({ children }) => {
  const baseColor = getCSSVariableValue("--kt-primary");
  TopBarProgress.config({
    barColors: {
      "0": baseColor,
    },
    barThickness: 1,
    shadowBlur: 5,
  });
  return <Suspense fallback={<TopBarProgress />}>{children}</Suspense>;
};

export { AppRoutes };