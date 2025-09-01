/**
 * High level router.
 *
 * Note: It's recommended to compose related routes in internal router
 * components (e.g: `src/app/modules/Auth/pages/AuthPage`, `src/app/BasePage`).
 */

import { FC, lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TopBarProgress from "react-topbar-progress-indicator";
import { getCSSVariableValue } from "../../_metronic/assets/ts/_utils";
import { WithChildren } from "../../_metronic/helpers";
import { AuthRedirectPage } from "../../app/pages/authRedirectPage";
import { App } from "../App";
import { Logout, useAuth } from "../modules/auth";
import { ErrorsPage } from "../modules/errors/ErrorsPage";
import CompilerPage from "../pages/Compiler/compiler";
import CompilerListQuestion from "../pages/Compiler/compilerListQuestion";
import CompilerPage_Student from "../pages/Compiler_Student/compiler";
import FacultyRegistrationForm from "../pages/FacultyRegistration/FacultyRegistrationForm";
import StudentDetailPage from "../pages/StudentRegistration/StudentRegistrationForm";
import { ThankYouPage } from "../pages/StudentRegistration/ThankYou";
import { UniRollNoUpdate } from "../pages/StudentRegistration/UniRollNoUpdate";
import { PrivateRoutes } from "./PrivateRoutes";
// import CompilerPageEdit from "../pages/Compiler/compilerEdit";

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
    <BrowserRouter basename={PUBLIC_URL}>
      <Routes>
        <Route element={<App />}>
          <Route path="/student-details" element={<StudentDetailPage />} />
          <Route path="/oauth2/redirect" element={<AuthRedirectPage />} />
          <Route path="error/*" element={<ErrorsPage />} />
          <Route path="compiler/*" element={<CompilerPage />} />
          <Route path="compiler_student/*" element={<CompilerPage_Student />} />
          <Route
            path="compiler/list/questions"
            element={<CompilerListQuestion />}
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

          <>
              <Route path="/*" element={<PrivateRoutes />} />
              <Route index element={<Navigate to="/dashboard" />} />
            </>

          {/* {currentUser ? (
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
          } */}

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
    </BrowserRouter>
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
