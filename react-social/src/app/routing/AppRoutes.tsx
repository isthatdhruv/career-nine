/**
 * High level router.
 *
 * Note: It's recommended to compose related routes in internal router
 * components (e.g: `src/app/modules/Auth/pages/AuthPage`, `src/app/BasePage`).
 */

import { FC, lazy, Suspense } from "react";
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
// import CompilerPageEdit from "../pages/Compiler/compilerEdit";
import {SchoolDashboardPage} from "../pages/dashboard/SchoolDashboardPage";
import QuestionaireListPage from "../pages/CreateAssessment/components/questionaire/QuestionaireListPage";
import StudentLoginPage from "../pages/StudentLogin/StudentLoginPage";
import DemographicDetailsPage from "../pages/StudentLogin/DemographicDetailsPage";
import AllottedAssessmentPage from "../pages/StudentLogin/AllottedAssessmentPage";
import SectionInstructionPage from "../pages/StudentOnlineAssessment/components/SectionInstructionPage";
import SectionQuestionPage from "../pages/StudentOnlineAssessment/components/SectionQuestionPage";
import GeneralInstructionsPage from "../pages/StudentOnlineAssessment/components/GeneralInstructionsPage";

import SelectSectionPage from "../pages/StudentOnlineAssessment/components/SelectSectionPage";
import PrincipalDashboard from "../pages/PrincipalDashboard/PrincipalDashboard";
import { MasterLayout } from "../../_metronic/layout/MasterLayout";

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
      <Route path="/studentAssessment" element={<SelectSectionPage />} />
            <Route
              path="/studentAssessment/sections/:sectionId"
              element={<SectionInstructionPage />}
            />
            <Route
              path="/studentAssessment/sections/:sectionId/questions/:questionIndex"
              element={<SectionQuestionPage />}
            />
            <Route
              path="/allotted-assessment"
              element={<AllottedAssessmentPage />}
            />
            <Route
              path="/general-instructions"
              element={<GeneralInstructionsPage />}
            />
            <Route
              path="/demographics"
              element={<DemographicDetailsPage />}
            />
            <Route
              path="/studentAssessment/completed"
              element={<ThankYouPage />}
            />
      <Route
              path="/student-login"
              element={
                <SuspensedView>
                  <StudentLoginPage />
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