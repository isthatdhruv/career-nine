import { FC, lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import TopBarProgress from "react-topbar-progress-indicator";
import { getCSSVariableValue } from "../../_metronic/assets/ts/_utils";
import { WithChildren } from "../../_metronic/helpers";
import { MasterLayout } from "../../_metronic/layout/MasterLayout";
import { useAuth } from "../modules/auth";
import { DashboardWrapper } from "../pages/dashboard/DashboardWrapper";
import FacultyRegistrationDetails from "../pages/FacultyRegistration/FacultyRegistrationDetails";
import FacultyRegistrationForm from "../pages/FacultyRegistration/FacultyRegistrationForm";
import * as _ from "underscore";
import { Error500 } from "../modules/errors/components/Error500";
import { Error401 } from "../modules/errors/components/Error401";

const PrivateRoutes = () => {
  const StudentsData = lazy(
    () => import("../pages/UniversityResult/StudentData")
  );
  const ResultPage = lazy(
    () => import("../pages/UniversityResult/FinalResult")
  );
  const StudentRegistrationDetails = lazy(
    () => import("../pages/StudentRegistration/StudentRegistrationDetails")
  );
  const ForgotPassword = lazy(
    () => import("../pages/Forgot-Password/ForgotPassword")
  );

  const GoogleGroups = lazy(
    () => import("../pages/GoogleGroups/GroupMembers/GoogleGroups")
  );

  const Groups = lazy(() => import("../pages/GoogleGroups/Groups"));

  const Group = lazy(() => import("../pages/Group/Group"));

  const OldStudentEmail = lazy(
    () => import("../pages/OldStudentEmail/OldStudentEmail")
  );

  const StudentRegistrationForm = lazy(
    () => import("../pages/StudentRegistration/StudentRegistrationForm")
  );

  const CourseBranchBatchPageForm = lazy(
    () => import("../pages/StudentRegistration/CourseBranchBatchPage")
  );

  const StudentList = lazy(
    () => import("../pages/StudentInformation/StudentsList")
  );
  const StudentProfile = lazy(
    () => import("../pages/StudentInformation/StudentProfile")
  );

  // const Compiler = lazy(() => import("../pages/Compiler/compiler"));

  const College = lazy(() => import("../pages/College/CollegePage"));
  const Board = lazy(() => import("../pages/Board/BoardPage"));
  const Section = lazy(() => import("../pages/Section/SectionPage"));
  const Course = lazy(() => import("../pages/Course/CoursePage"));
  const Branch = lazy(() => import("../pages/Branch/BranchPage"));
  const Batch = lazy(() => import("../pages/Batch/BatchPage"));
  const Session = lazy(() => import("../pages/Session/SessionPage"));
  const BatchGoogle = lazy(() => import("../pages/BatchGoogle/BatchGoogle"));
  const Role = lazy(() => import("../modules/role/Role"));
  const RoleRoleGroupPage = lazy(
    () => import("../modules/role_roleGroup/Role_RoleGroup")
  );
  const RoleUser = lazy(() => import("../modules/roleUser/RoleUser1"));
  const UniversityResultDashboard = lazy(
    () => import("../pages/UniversityResult/UniversityResultDashboard")
  );
  const [autorized, setAutorized] = useState(false);
  const { currentUser } = useAuth();
  const roles = currentUser?.authorityUrls;
  var location = useLocation();
  // console.log(_.contains(currentUser!.authorityUrls!, location.pathname));
  // // console.log(currentUser!.authorityUrls!, location.pathname)
  // const regex = new RegExp(currentUser!.authorityUrls![0], "i"); // 'i' flag for case-insensitive matching

  // if (!regex.test(location.pathname)) {
  //   if (location.pathname != "/dashboard") return <Error401></Error401>;
  // }
  // if (!autorized) { console.log("Arreb aur Somya are sole mates") }
  console.log(roles);
  // const Pdf = lazy(() => import("../pages/newRegistrationUpload/StudentService"));
  return (
    <Routes>
      <Route element={<MasterLayout />}>
        <Route path="auth/*" element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardWrapper />} />

        <Route
          path="/student/university/result-list"
          element={
            <SuspensedView>
              <StudentsData />
            </SuspensedView>
          }
        />

        <Route
          path="/student/university/result-dashboard"
          element={
            <SuspensedView>
              <UniversityResultDashboard />
            </SuspensedView>
          }
        />

        <Route
          path="/student/university/result"
          element={
            <SuspensedView>
              <ResultPage />
            </SuspensedView>
          }
        />
        {/* <Route
          path="pdf"
          element={
            <SuspensedView>
              <Pdf />
            </SuspensedView>
          }
        /> */}
        <Route
          path="/student/registrar/page"
          element={
            <SuspensedView>
              <CourseBranchBatchPageForm />
            </SuspensedView>
          }
        />

        <Route
          path="/student/registration-details"
          element={
            <SuspensedView>
              <StudentRegistrationDetails />
            </SuspensedView>
          }
        />
        <Route
          path="/faculty/registration-details"
          element={
            <SuspensedView>
              <FacultyRegistrationDetails />
            </SuspensedView>
          }
        />
        <Route
          path="/registrar/verification/faculty"
          element={
            <SuspensedView>
              <FacultyRegistrationForm />
            </SuspensedView>
          }
        />

        <Route
          path="/registrar/verification"
          element={
            <SuspensedView>
              <StudentRegistrationForm />
            </SuspensedView>
          }
        />

        <Route
          path="/forgotpassword"
          element={
            <SuspensedView>
              <ForgotPassword />
            </SuspensedView>
          }
        />

        <Route
          path="google-groups"
          element={
            <SuspensedView>
              <GoogleGroups />
            </SuspensedView>
          }
        />

        <Route
          path="groups"
          element={
            <SuspensedView>
              <Groups />
            </SuspensedView>
          }
        />

<Route
          path="group"
          element={
            <SuspensedView>
              <Group />
            </SuspensedView>
          }
        />

        <Route
          path="/old-student-email"
          element={
            <SuspensedView>
              <OldStudentEmail />
            </SuspensedView>
          }
        />

        <Route
          path="/board"
          element={
            <SuspensedView>
              <Board />
            </SuspensedView>
          }
        />

        <Route
          path="/section"
          element={
            <SuspensedView>
              <Section />
            </SuspensedView>
          }
        />
        {
          <Route
            path="/college"
            element={
              <SuspensedView>
                <College />
              </SuspensedView>
            }
          />
        }
        <Route
          path="/course"
          element={
            <SuspensedView>
              <Course />
            </SuspensedView>
          }
        />
        <Route
          path="/branch"
          element={
            <SuspensedView>
              <Branch />
            </SuspensedView>
          }
        />
        <Route
          path="/batch"
          element={
            <SuspensedView>
              <Batch />
            </SuspensedView>
          }
        />
        <Route
          path="/session"
          element={
            <SuspensedView>
              <Session />
            </SuspensedView>
          }
        />

        <Route
          path="/batchgoogle"
          element={
            <SuspensedView>
              <BatchGoogle />
            </SuspensedView>
          }
        />

        <Route
          path="/studentlist"
          element={
            <SuspensedView>
              <StudentList />
            </SuspensedView>
          }
        />
        <Route
          path="/studentprofile"
          element={
            <SuspensedView>
              <StudentProfile />
            </SuspensedView>
          }
        />

        <Route
          path="/roles/role"
          element={
            <SuspensedView>
              <Role />
            </SuspensedView>
          }
        />

        <Route
          path="/roles/role_roleGroup"
          element={
            <SuspensedView>
              <RoleRoleGroupPage />
            </SuspensedView>
          }
        />

        <Route
          path="/roles/roleUser"
          element={
            <SuspensedView>
              <RoleUser />
            </SuspensedView>
          }
        />

        {/* Page Not Found */}
        <Route path="*" element={<Navigate to="/error/404" />} />
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

export { PrivateRoutes };

function setAutorized(arg0: boolean) {
  throw new Error("Function not implemented.");
}
