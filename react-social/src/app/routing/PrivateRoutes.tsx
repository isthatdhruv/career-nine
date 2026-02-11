import { FC, lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import TopBarProgress from "react-topbar-progress-indicator";
import { getCSSVariableValue } from "../../_metronic/assets/ts/_utils";
import { WithChildren } from "../../_metronic/helpers";
import { MasterLayout } from "../../_metronic/layout/MasterLayout";
import { useAuth } from "../modules/auth";
import CareerPage from "../pages/Career/CareerPage";
import { CareerCreatePage, CareerEditPage } from "../pages/Career/components";
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
import UploadExcelFile from "../pages/UploadExcelFile/UploadExcelFile";
// Update these paths to the correct locations of your components
import Assessments from "../pages/CreateAssessment/Assessment";
// import AssessmentCreatePage from "../pages/CreateAssessment/components/assessment/AssessmentCreatePage";
import QuestionareCreateSinglePage from "../pages/CreateAssessment/components/questionaire/QuestionareCreateSinglePage";
import QuestionareEditSinglePage from "../pages/CreateAssessment/components/questionaire/QuestionareEditSinglePage";
import AssessmentEditPage from "../pages/CreateAssessment/components/assessment/AssessmentEditandCreatePage";
import AssessmentToolPage from "../pages/CreateAssessment/components/AssessmentToolPage";
import AssessmentUploadFile from "../pages/CreateAssessment/components/AssessmentUploadFile";
import AssessmentSection from "../pages/CreateAssessment/components/AssessmentSection";
import AssessmentQuestion from "../pages/CreateAssessment/components/AssessmentQuestion";
import ContactPersonCreatePage from "../pages/ContactPerson/components/ContactPersonCreatePage";
import { ContactPersonEditPage } from "../pages/ContactPerson/components";
import ContactPersonPage from "../pages/ContactPerson/ContactPersonPage";
import LoginPage from "../pages/Login/components/LoginPage";
import LoginEnterEmail from "../pages/Login/components/LoginEnterEmail";
import LoginCheckEmail from "../pages/Login/components/LoginCheckEmail";
import LoginChangePassword from "../pages/Login/components/LoginChangePassword";
import Users from "../pages/Users/components/Users";
import UserRegistration from "../pages/Users/components/UserRegistration";
import ListCreatePage from "../pages/List/components/ListCreatePage";
import ListEditPage from "../pages/List/components/ListEditPage";
import ListPage from "../pages/List/CreateList";
import Assessment from "../pages/StudentOnlineAssessment/components/SelectSectionPage";
import SelectSectionPage from "../pages/StudentOnlineAssessment/components/SelectSectionPage";
import SectionInstructionPage from "../pages/StudentOnlineAssessment/components/SectionInstructionPage";
import { SchoolDashboardPage } from "../pages/dashboard/SchoolDashboardPage";
import SectionQuestionPage from "../pages/StudentOnlineAssessment/components/SectionQuestionPage";
import studentsList from "../pages/StudentInformation/StudentsList";
// import QuestionaireList from "../pages/CreateAssessment/components/questionaire/QuestionaireListPage";
import QuestionaireListPage from "../pages/CreateAssessment/components/questionaire/QuestionaireListPage";
import StudentsList from "../pages/StudentInformation/StudentsList";
import GroupCreatePage from "../pages/dashboard/widgets/CreateNewGroup";
import StudentCreatePage from "../pages/dashboard/widgets/CreateNewStudent";
import GroupStudentPage from "../pages/GroupStudent/GroupStudentPage";
import StudentLoginPage from "../pages/StudentLogin/StudentLoginPage";
import AllottedAssessmentPage from "../pages/StudentLogin/AllottedAssessmentPage";
import GamePage from "../pages/Games/GamePage";
// import QuestionareEditSinglePage from "../pages/CreateAssessment/components/questionaire/QuestionareEditSinglePage";
import DashboardAdminPage from "../pages/demo-dashboard-v2/dashboard-admin";
import DemographicDetailsPage from "../pages/StudentLogin/DemographicDetailsPage";
import ThankYouPage from "../pages/StudentOnlineAssessment/components/ThankYouPage";
import GeneralInstructionsPage from "../pages/StudentOnlineAssessment/components/GeneralInstructionsPage";
import InstituteDashboard from "../pages/dashboard/InstituteDashboard";
import ReportsPage from "../pages/Reports/ReportsPage";
import StudentDashboard from "../pages/StudentDashboard/StudentDashboard";
import ClassTeacherDashboard from "../pages/ClassTeacherDashboard/ClassTeacherDashboard";
import PrincipalDashboard from "../pages/PrincipalDashboard/PrincipalDashboard";
import { Error401 } from "../modules/errors/components/Error401";
import _ from "lodash";

// Paths that every logged-in user can access without role check
const ALWAYS_ALLOWED = [
  "/dashboard",
  "/auth",
  "/login",
  "/student-login",
  "/studentAssessment",
  "/allotted-assessment",
  "/general-instructions",
  "/demographics",
  "/login/reset-password",
];

const AuthorizedLayout = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  const isAlwaysAllowed = ALWAYS_ALLOWED.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  if (!isAlwaysAllowed) {
    const authorityUrls: string[] = currentUser?.authorityUrls ?? [];
    console.log("User's authority URLs:", authorityUrls);

    const isAuthorized = authorityUrls.some((pattern) => {
      // If pattern contains *, convert to regex
      if (pattern.includes("*")) {
        // Escape regex special chars except *, then replace * with .*
        const regexStr =
          "^" +
          pattern
            .replace(/([.+?^${}()|[\]\\])/g, "\\$1")
            .replace(/\*/g, ".*") +
          "$";
        return new RegExp(regexStr).test(location.pathname);
      }
      // Exact match or sub-route match
      return (
        location.pathname === pattern ||
        location.pathname.startsWith(pattern + "/")
      );
    });

    if (!isAuthorized) {
      return <Error401 />;
    }
  }

  return <MasterLayout />;
};

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

  const Groups = lazy(() => import("../pages/dashboard/widgets/Groups"));

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

  const MeasuredQualityTypes = lazy(
    () => import("../pages/MeasuredQualityTypes/CreateMeasuredQualityTypes")
  );
  const MeasuredQualities = lazy(
    () => import("../pages/MeasuredQualities/MeasuredQualities")
  );
  const Tools = lazy(() => import("../pages/Tool/CreateTool"));
  const List = lazy(() => import("../pages/List/CreateList"));
  const College = lazy(() => import("../pages/College/CollegePage"));
  // Update the import path below to the correct location if the file exists elsewhere
  const CollegeCreatePage = lazy(() => import("../pages/College/CollegePage"));
  const CollegeEditPage = lazy(
    () => import("../pages/College/components/CollegeEditModal")
  );
  const AssessmentQuestions = lazy(
    () => import("../pages/AssesmentQuestions/CreateQuestion")
  );
  const QuestionCreatePage = lazy(
    () => import("../pages/AssesmentQuestions/components/QuestionCreatePage")
  );
  const QuestionEditPage = lazy(
    () => import("../pages/AssesmentQuestions/components/QuestionEditPage")
  );
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
  return (
    <Routes>
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
        path="/login/reset-password/enter-email"
        element={
          <SuspensedView>
            <LoginEnterEmail />
          </SuspensedView>
        }
      />
      <Route
        path="/"
        element={
          <SuspensedView>
            <LoginEnterEmail />
          </SuspensedView>
        }
      />
      <Route
        path="/student-login"
        element={
          <SuspensedView>
            <StudentLoginPage />
          </SuspensedView>
        }
      />

      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthorizedLayout />}>
        <Route path="auth/*" element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardAdminPage />} />

        <Route path="/school/dashboard/:id" element={
          <SuspensedView>
            <InstituteDashboard />
          </SuspensedView>
        } />
        <Route
          path="/student/university/result-list"
          element={
            <SuspensedView>
              <StudentsData />
            </SuspensedView>
          }
        />
        <Route path="/dashboard/school/:id" element={
          <SuspensedView>
            <SchoolDashboardPage />
          </SuspensedView>
        } />
        <Route path="/game-list" element={
          <SuspensedView>
            <GamePage />
          </SuspensedView>
        } />
        <Route path="/questionaire/List" element={
          <SuspensedView>
            <QuestionaireListPage />
          </SuspensedView>
        } />
        <Route
          path="/login/reset-password/check-email"
          element={
            <SuspensedView>
              <LoginCheckEmail />
            </SuspensedView>
          }
        />
        <Route
          path="/login/reset-password/change-password"
          element={
            <SuspensedView>
              <LoginChangePassword />
            </SuspensedView>
          }
        />
        <Route path="/school/dashboard/studentList" element={
          <SuspensedView>
            <StudentsList />
          </SuspensedView>
        } />
        <Route path="/students/${member.id}/dashboard" element={
          <SuspensedView>
            <StudentsList />
          </SuspensedView>
        } />
        <Route path="/school/groups" element={
          <SuspensedView>
            <Groups />
          </SuspensedView>
        } />
        <Route path="/school/group/create" element={
          <SuspensedView>
            <GroupCreatePage />
          </SuspensedView>
        } />
        <Route path="/school/student/create" element={
          <SuspensedView>
            <StudentCreatePage />
          </SuspensedView>
        } />

        <Route path="/group-student" element={
          <SuspensedView>
            <GroupStudentPage />
          </SuspensedView>
        } />

        <Route path="/student-dashboard/:studentId" element={
          <SuspensedView>
            <StudentDashboard />
          </SuspensedView>
        } />

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
          path="/faculty/registration-form"
          element={
            <SuspensedView>
              <FacultyRegistrationForm />
            </SuspensedView>
          }
        />
        <Route
          path="/teacher/class-dashboard"
          element={
            <SuspensedView>
              <ClassTeacherDashboard />
            </SuspensedView>
          }
        />
        <Route
          path="/principal/dashboard"
          element={
            <SuspensedView>
              <PrincipalDashboard />
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
          path="/career"
          element={
            <SuspensedView>
              <CareerPage />
            </SuspensedView>
          }
        />
        <Route
          path="/career/create"
          element={
            <SuspensedView>
              <CareerCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/career/edit/:id"
          element={
            <SuspensedView>
              <CareerEditPage />
            </SuspensedView>
          }
        />
        <Route
          path="/contact-person"
          element={
            <SuspensedView>
              <ContactPersonPage />
            </SuspensedView>
          }
        />
        <Route
          path="/contact-person/create"
          element={
            <SuspensedView>
              <ContactPersonCreatePage />
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
              <CollegeCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/question-sections"
          element={
            <SuspensedView>
              <QuestionSectionPage />
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
          path="/list"
          element={
            <SuspensedView>
              <ListPage />
            </SuspensedView>
          }
        />
        <Route
          path="/list/create"
          element={
            <SuspensedView>
              <ListCreatePage />
            </SuspensedView>
          }
        />
        <Route
          path="/list/edit/:id"
          element={
            <SuspensedView>
              <ListEditPage />
            </SuspensedView>
          }
        />
        <Route
          path="/upload-excel"
          element={
            <SuspensedView>
              <UploadExcelFile />
            </SuspensedView>
          }
        />
        <Route
          path="/assessments"
          element={
            <SuspensedView>
              <Assessments />
            </SuspensedView>
          }
        />
        <Route
          path="/assessments/create/step-2"
          element={
            <SuspensedView>
              <AssessmentToolPage />
            </SuspensedView>
          }
        />
        <Route
          path="/assessments/create/step-3"
          element={
            <SuspensedView>
              <AssessmentUploadFile />
            </SuspensedView>
          }
        />
        <Route
          path="/assessments/create/step-4"
          element={
            <SuspensedView>
              <AssessmentSection />
            </SuspensedView>
          }
        />
        <Route
          path="/assessments/create/step-5"
          element={
            <SuspensedView>
              <AssessmentQuestion />
            </SuspensedView>
          }
        />
        <Route
          path="/questionare/create"
          element={
            <SuspensedView>
              <QuestionareCreateSinglePage />
            </SuspensedView>
          }
        />
        <Route
          path="/questionare/edit/:id"
          element={
            <SuspensedView>
              <QuestionareEditSinglePage />
            </SuspensedView>
          }
        />

        <Route
          path="/assessments/create"
          element={
            <SuspensedView>
              <AssessmentEditPage />
            </SuspensedView>
          }
        />
        <Route
          path="/assessments/edit/:id"
          element={
            <SuspensedView>
              <AssessmentEditPage />
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
          path="/roles/users"
          element={
            <SuspensedView>
              <Users />
            </SuspensedView>
          }
        />
        <Route
          path="/user-registrations"
          element={
            <SuspensedView>
              <UserRegistration />
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
        <Route
          path="/reports"
          element={
            <SuspensedView>
              <ReportsPage />
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
