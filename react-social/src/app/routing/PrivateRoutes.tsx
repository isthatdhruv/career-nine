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
import { MeasuredQualitiesEditPage } from "../pages/MeasuredQualities/components";
import MeasuredQualitiesCreatePage from "../pages/MeasuredQualities/components/MeasuredQualitiesCreatePage";
import { MeasuredQualityTypesEditPage } from "../pages/MeasuredQualityTypes/components";
import MeasuredQualityTypesCreatePage from "../pages/MeasuredQualityTypes/components/MeasuredQualityTypesCreatePage";
import QuestionSectionCreatePage from "../pages/QuestionSections/components/QuestionSectionCreatePage";
import QuestionSectionEditPage from "../pages/QuestionSections/components/QuestionSectionEditPage";
import QuestionSectionPage from "../pages/QuestionSections/CreateQuestionSection";
import { ToolEditPage } from "../pages/Tool/components";
import ToolCreatePage from "../pages/Tool/components/ToolCreatePage";
// Update these paths to the correct locations of your components


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

  const MeasuredQualityTypes = lazy(() => import("../pages/MeasuredQualityTypes/CreateMeasuredQualityTypes"));
  const MeasuredQualities = lazy(() => import("../pages/MeasuredQualities/CreateMeasuredQualities"));
  const Tools = lazy(() => import("../pages/Tool/CreateTool"));
  const College = lazy(() => import("../pages/College/CollegePage"));
  // Update the import path below to the correct location if the file exists elsewhere
  const CollegeCreatePage = lazy(() => import("../pages/College/CollegePage"));
  const CollegeEditPage = lazy(() => import("../pages/College/components/CollegeEditModal"));
  const AssessmentQuestions = lazy(() => import("../pages/AssesmentQuestions/CreateQuestion"));
  const QuestionCreatePage = lazy(() => import("../pages/AssesmentQuestions/components/QuestionCreatePage"));
  const QuestionEditPage = lazy(() => import("../pages/AssesmentQuestions/components/QuestionEditPage"));
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
  // const UniversityAllResultDashboard = lazy(
  //   () => import("../pages/UniversityResult/UniversityAllResultDashboard")
  // );
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
        {/*
                <Route
                  path="/student/university/all-result-dashboard"
                  element={
                    <SuspensedView>
                      <UniversityAllResultDashboard />
                    </SuspensedView>
                  }
                />
        */}
        ```

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
          path="/college/create"
          element={
            <SuspensedView>
              <CollegeCreatePage  />
            </SuspensedView>
          }
        />
        <Route
          path="/question-sections"
          element={
            <SuspensedView>
              <QuestionSectionPage/>
            </SuspensedView>
          }
        />
        <Route
          path="/question-sections/create"
          element={
            <SuspensedView>
              <QuestionSectionCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/question-sections/edit/:id"
          element={
            <SuspensedView>
              <QuestionSectionEditPage />
            </SuspensedView>
          }
        />
        {/* <Route
          path="/college/edit/:id"
          element={
            <SuspensedView>
              <CollegeEditPage  />
            </SuspensedView>
          }
        /> */}
        <Route
          path="/assessment-questions"
          element={
            <SuspensedView>
              <AssessmentQuestions />
            </SuspensedView>
          }
        />
        <Route
          path="/assessment-questions/create"
          element={
            <SuspensedView>
              <QuestionCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/assessment-questions/edit/:id"
          element={
            <SuspensedView>
              <QuestionEditPage />
            </SuspensedView>
          }
        />

        <Route
          path="/tools"
          element={
            <SuspensedView>
              <Tools />
            </SuspensedView>
          }
        />
        <Route
          path="/tools/create"
          element={
            <SuspensedView>
              <ToolCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/tools/edit/:id"
          element={
            <SuspensedView>
              <ToolEditPage />
            </SuspensedView>
          }
        />

        <Route
          path="/measured-qualities"
          element={
            <SuspensedView>
              <MeasuredQualities />
            </SuspensedView>
          }
        />
        <Route
          path="/measured-qualities/create"
          element={
            <SuspensedView>
              <MeasuredQualitiesCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/measured-qualities/edit/:id"
          element={
            <SuspensedView>
              <MeasuredQualitiesEditPage />
            </SuspensedView>
          }
        />

          <Route
          path="/measured-quality-types"
          element={
            <SuspensedView>
              <MeasuredQualityTypes />
            </SuspensedView>
          }
        />
        <Route
          path="/measured-quality-types/create"
          element={
            <SuspensedView>
              <MeasuredQualityTypesCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/measured-quality-types/edit/:id"
          element={
            <SuspensedView>
              <MeasuredQualityTypesEditPage />
            </SuspensedView>
          }
        />

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
        {/* <Route path="*" element={<Navigate to="/error/404" />} /> */}
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
