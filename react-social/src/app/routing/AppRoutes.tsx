/**
 * High level router.
 *
 * Note: It's recommended to compose related routes in internal router
 * components (e.g: `src/app/modules/Auth/pages/AuthPage`, `src/app/BasePage`).
 */

import { FC, lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
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
import StudentRoutes from "./StudentRoutes";
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

const AssessmentRegisterPage = lazy(
  () => import("../pages/AssessmentRegister/AssessmentRegisterPage")
);
const SchoolAssessmentRegisterPage = lazy(
  () => import("../pages/SchoolRegistration/SchoolAssessmentRegisterPage")
);
const PaymentStatusPage = lazy(
  () => import("../pages/PaymentTracking/PaymentStatusPage")
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
      <Route path="/student/*" element={<StudentRoutes />} />
      <Route path="/counsellor/*" element={<CounsellorRoutes />} />

      <Route element={<App />}>
        <Route path="/student-details" element={<StudentDetailPage />} />
        <Route path="/oauth2/redirect" element={<AuthRedirectPage />} />
        <Route path="error/*" element={<ErrorsPage />} />
        
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
              element={
                <SuspensedView>
                  <AssessmentRegisterPage />
                </SuspensedView>
              }
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
              element={
                <SuspensedView>
                  <PaymentStatusPage />
                </SuspensedView>
              }
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