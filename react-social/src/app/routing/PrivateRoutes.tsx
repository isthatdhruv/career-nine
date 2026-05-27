import { FC, lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import TopBarProgress from "react-topbar-progress-indicator";
import { getCSSVariableValue } from "../../_metronic/assets/ts/_utils";
import { WithChildren } from "../../_metronic/helpers";
import { MasterLayout } from "../../_metronic/layout/MasterLayout";
import { RequirePermission } from "../modules/auth";
import CareerPage from "../pages/Career/CareerPage";
import { CareerCreatePage, CareerEditPage } from "../pages/Career/components";
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
import SchoolDashboardPage from "../pages/Dashboards/SchoolDashboardPage";
import SchoolNavigatorDashboardPage from "../pages/Dashboards/SchoolNavigatorDashboardPage";
// import QuestionaireList from "../pages/CreateAssessment/components/questionaire/QuestionaireListPage";
import QuestionaireListPage from "../pages/CreateAssessment/components/questionaire/QuestionaireListPage";
import StudentsList from "../pages/StudentInformation/StudentsList";
import GroupCreatePage from "../pages/dashboard/widgets/CreateNewGroup";
import StudentCreatePage from "../pages/dashboard/widgets/CreateNewStudent";
import GroupStudentPage from "../pages/GroupStudent/GroupStudentPage";
import ReminderManagementPage from "../pages/ReminderManagement/ReminderManagementPage";
// import StudentManagementPage from "../pages/GroupStudent/StudentManagementPage";
import StudentListPage from "../pages/GroupStudent/StudentListPage";
// GroupStudentAdminPage removed — consolidated into Data Download (/group-student)
import GroupStudentSchoolPage from "../pages/GroupStudent/GroupStudentSchoolPage";
import AssignedStudentsPage from "../pages/GroupStudent/AssignedStudentsPage";
import ReportGenerationPage from "../pages/ReportGeneration/ReportGenerationPage";
import BetReportGenerationPage from "../pages/ReportGeneration/BetReportGenerationPage";
import NavigatorReportGenerationPage from "../pages/NavigatorReportGeneration/NavigatorReportGenerationPage";
import UnifiedReportManagementPage from "../pages/UnifiedReportManagement/UnifiedReportManagementPage";
import SendReportsPage from "../pages/SendReports/SendReportsPage";
import GamePage from "../pages/Games/GamePage";
import DemographicFieldsPage from "../pages/DemographicFields/DemographicFieldsPage";
import DemographicFieldCreatePage from "../pages/DemographicFields/components/DemographicFieldCreatePage";
import DemographicFieldEditPage from "../pages/DemographicFields/components/DemographicFieldEditPage";
// import QuestionareEditSinglePage from "../pages/CreateAssessment/components/questionaire/QuestionareEditSinglePage";
import CareerSuggestionPage from "../pages/CareerSuggestion/CareerSuggestionPage";
import DashboardAdminPage from "../pages/demo-dashboard-v2/dashboard-admin";
import InstituteDashboard from "../pages/dashboard/InstituteDashboard";
import ActivityLogPage from "../pages/ActivityLog/ActivityLogPage";
import LeadsPage from "../pages/Leads/LeadsPage";
import LiveTrackingPage from "../pages/LiveTracking/LiveTrackingPage";
import CommunicationLogsPage from "../pages/CommunicationLogs/CommunicationLogsPage";
import ReportsPage from "../pages/Reports/ReportsPage";
import ReportsHubPage from "../pages/ReportsHub/ReportsHubPage";
import AdminAssessmentEditPage from "../pages/ReportsHub/AdminAssessmentEdit/AdminAssessmentEditPage";
import StudentDashboard from "../pages/StudentDashboard/StudentDashboard";
import ClassTeacherDashboard from "../pages/ClassTeacherDashboard/ClassTeacherDashboard";
import StudentManagementPage from "../pages/GroupStudent/StudentManagementPage";


/** Backwards-compat: legacy /student-dashboard/:studentId -> /dashboard/student/view/:studentId */
const RedirectStudentDashboard: FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  return <Navigate to={`/dashboard/student/view/${studentId ?? ""}`} replace />;
};

// Paths that every logged-in user can access without a per-route permission check.
// Preserved verbatim per Phase 17 locked decision — Phase 17 does NOT add or remove entries.
// 17-04's monitoring guidance uses this list as "routes a logged-in-but-no-perms user can still
// reach" — DENY decisions on these in `auth_audit` are bugs, not legitimate access controls.
//
// Note: This constant is currently only documentation/monitoring scaffolding. The actual
// "always-allowed" behavior is enforced by the absence of <RequirePermission> wrappers on
// the corresponding <Route> elements below. See plan 17-02 for the per-route mapping.
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
  "/b2c",
];
// Suppress "declared but never read" — kept intentionally per locked decision (see comment above).
void ALWAYS_ALLOWED;

const AuthorizedLayout = () => {
  // Per-route permission checks now happen via <RequirePermission> wrappers on
  // each <Route element=…>. This layout no longer enforces URL-pattern auth —
  // it just renders the MasterLayout shell. The ALWAYS_ALLOWED list above is kept
  // for future use if we ever need to short-circuit BOTH permission AND login for
  // a path, but Phase 17 does not invoke it from this component (the routes
  // inside ALWAYS_ALLOWED simply have no <RequirePermission> wrapper — see route
  // definitions below).
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

  // R2: separate student login dissolved — students sign in via the unified /auth
  // login page (student/DOB mode). Kept commented per the no-deletion policy.
  // const StudentDashboardLogin = lazy(
  //   () => import("../pages/StudentDashboard/student-portal/StudentDashboardLogin")
  // );
  const StudentPortalDashboard = lazy(
    () => import("../pages/StudentDashboard/student-portal/StudentPortalDashboard")
  );
  const StudentInfoForm = lazy(
    () => import("../pages/StudentDashboard/student-portal/StudentInfoForm")
  );
  const StudentPortalNavigator360 = lazy(
    () => import("../pages/StudentDashboard/student-portal/StudentNavigator360Page")
  );
  const StudentPortalAssessments = lazy(
    () => import("../pages/StudentDashboard/student-portal/StudentAssessments")
  );
  const StudentPortalReports = lazy(
    () => import("../pages/StudentDashboard/student-portal/StudentReports")
  );
  const StudentCounsellingPage = lazy(
    () => import("../pages/Counselling/student/StudentCounsellingPage")
  );
  const SlotBookingPage = lazy(
    () => import("../pages/Counselling/student/SlotBookingPage")
  );

  // const Compiler = lazy(() => import("../pages/Compiler/compiler"));

  const MeasuredQualityTypes = lazy(
    () => import("../pages/MeasuredQualityTypes/CreateMeasuredQualityTypes")
  );
  const MeasuredQualities = lazy(
    () => import("../pages/MeasuredQualities/MeasuredQualities")
  );
  const Tools = lazy(() => import("../pages/Tool/CreateTool"));
  const College = lazy(() => import("../pages/College/CollegePage"));
  // Update the import path below to the correct location if the file exists elsewhere
  const CollegeCreatePage = lazy(() => import("../pages/College/CollegePage"));
  const AssessmentMappingPage = lazy(() => import("../pages/AssessmentMapping/AssessmentMappingPage"));
  const AssessmentQuestions = lazy(
    () => import("../pages/AssesmentQuestions/CreateQuestion")
  );
  const QuestionCreatePage = lazy(
    () => import("../pages/AssesmentQuestions/components/QuestionCreatePage")
  );
  const QuestionEditPage = lazy(
    () => import("../pages/AssesmentQuestions/components/QuestionEditPage")
  );
  const QuestionDuplicatesPage = lazy(
    () => import("../pages/AssesmentQuestions/components/QuestionDuplicatesPage")
  );
  const OfflineAssessmentUpload = lazy(
    () => import("../pages/OfflineAssessmentUpload/OfflineAssessmentUploadPage")
  );
  const OMRDataUpload = lazy(
    () => import("../pages/OfflineAssessmentUpload/OMRDataUploadPage")
  );
  const TextResponseMapping = lazy(
    () => import("../pages/TextResponseMapping/TextResponseMappingPage")
  );
  const OldDataMappingPage = lazy(
    () => import("../pages/OldDataMapping/OldDataMappingPage")
  );
  const ScoreDebugPage = lazy(
    () => import("../pages/ScoreDebug/ScoreDebugPage")
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
  const RolesAndPermissionsPage = lazy(() => import("../pages/RolesAndPermissions/RolesAndPermissionsPage"));
  const UserManagementPage = lazy(() => import("../pages/UserManagement/UserManagementPage"));
  const UniversityResultDashboard = lazy(
    () => import("../pages/UniversityResult/UniversityResultDashboard")
  );
  const CounsellorDashboardPage = lazy(() => import("../pages/Counselling/counsellor/CounsellorDashboardPage"));
  const AvailabilityManagerPage = lazy(() => import("../pages/Counselling/counsellor/AvailabilityManagerPage"));
  const SessionNotesPage = lazy(() => import("../pages/Counselling/counsellor/SessionNotesPage"));
  const CounsellorManagementPage = lazy(() => import("../pages/Counselling/admin/CounsellorManagementPage"));
  const SlotManagementPage = lazy(() => import("../pages/Counselling/admin/SlotManagementPage"));
  const ManageStudentsPage = lazy(() => import("../pages/Counselling/admin/ManageStudentsPage"));
  const CounsellingNotificationsPage = lazy(() => import("../pages/Counselling/admin/CounsellingNotificationsPage"));
  const ReportTypesPage = lazy(() => import("../pages/ReportTypes/ReportTypesPage"));
  const ReportTypesCreatePage = lazy(() => import("../pages/ReportTypes/components/ReportTypesCreatePage"));
  const ReportTypesEditPage = lazy(() => import("../pages/ReportTypes/components/ReportTypesEditPage"));
  const PaymentTrackingPage = lazy(() => import("../pages/PaymentTracking/PaymentTrackingPage"));
  const PromoCodePage = lazy(() => import("../pages/PromoCode/PromoCodePage"));
  const PaymentRegisterPage = lazy(() => import("../pages/PaymentTracking/PaymentRegisterPage"));
  const B2CPricingTierPage = lazy(() => import("../pages/B2C/PricingTier/PricingTierPage"));
  const B2CCampaignPage = lazy(() => import("../pages/B2C/Campaign/CampaignPage"));
  const B2CCampaignEditPage = lazy(() => import("../pages/B2C/Campaign/CampaignEditPage"));
  const B2CTrackerPage = lazy(() => import("../pages/B2C/Tracker/TrackerPage"));
  // const UniversityAllResultDashboard = lazy(
  //   () => import("../pages/UniversityResult/UniversityAllResultDashboard")
  // );
  return (
    <Routes>

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


      <Route path="/login" element={<LoginPage />} />

      {/* Standalone "view student dashboard" — opened by the admin Data Download
          "Dashboard" button. Renders the student portal page WITHOUT the Metronic
          aside menu, so the admin sees what the student sees when they log in.
          Permission-protected but layout-free. */}
      <Route path="/student/dashboard-preview" element={
        <RequirePermission perm="student.read">
          <SuspensedView>
            <StudentPortalDashboard />
          </SuspensedView>
        </RequirePermission>
      } />

      {/* payment-status and payment-register moved to public AppRoutes */}
      <Route element={<AuthorizedLayout />}>
        <Route path="auth/*" element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardAdminPage />} />

        <Route path="/school/principal/dashboard/:id" element={
          <RequirePermission perm="institute.read">
            <SuspensedView>
              <InstituteDashboard />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/reminders" element={
          <RequirePermission perm="reminders.view">
            <SuspensedView>
              <ReminderManagementPage />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route
          path="/student/university/result-list"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <StudentsData />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route path="/dashboard/school/:id" element={
          <RequirePermission perm="institute.read">
            <SuspensedView>
              <SchoolDashboardPage />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/dashboard/school-navigator/:id" element={
          <RequirePermission perm="institute.read">
            <SuspensedView>
              <SchoolNavigatorDashboardPage />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/game-list" element={
          <SuspensedView>
            <GamePage />
          </SuspensedView>
        } />
        <Route path="/questionaire/List" element={
          <RequirePermission perm="assessment.read">
            <SuspensedView>
              <QuestionaireListPage />
            </SuspensedView>
          </RequirePermission>
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
        <Route path="/school/principal/dashboard/studentList" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <StudentsList />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/students/${member.id}/dashboard" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <StudentsList />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/school/groups" element={
          <RequirePermission perm="group.read">
            <SuspensedView>
              <Groups />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/school/group/create" element={
          <RequirePermission perm="group.write">
            <SuspensedView>
              <GroupCreatePage />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/school/student/create" element={
          <RequirePermission perm="student.write">
            <SuspensedView>
              <StudentCreatePage />
            </SuspensedView>
          </RequirePermission>
        } />

        <Route path="/group-student" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <GroupStudentPage />
            </SuspensedView>
          </RequirePermission>
        } />

        {/* /student-management: clone of /group-student with every data-export
            path stripped (single answer + bulk answers + proctoring + report
            generation + report email). Keeps Student List xlsx, allot, reset,
            edit basic info, demographics view. Gated by its own permission
            so admins can hand out management without granting downloads. */}
        <Route path="/student-management" element={
          <RequirePermission perm="student_management.read">
            <SuspensedView>
              <StudentManagementPage />
            </SuspensedView>
          </RequirePermission>
        } />

        {/* /student-list: view-only sibling of /group-student. Same data, no
            download buttons, multi-select assessment picker per row. */}
        <Route path="/student-list" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <StudentManagementPage/>
            </SuspensedView>
          </RequirePermission>
        } />

        <Route path="/school/group-student" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <GroupStudentSchoolPage />
            </SuspensedView>
          </RequirePermission>
        } />

        <Route path="/school/assigned-students" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <AssignedStudentsPage />
            </SuspensedView>
          </RequirePermission>
        } />

        <Route path="/report-generation" element={
          <RequirePermission perm="report.read">
            <SuspensedView>
              <ReportGenerationPage />
            </SuspensedView>
          </RequirePermission>
        } />

        <Route path="/career-suggestion" element={
          <RequirePermission perm="career.read">
            <SuspensedView>
              {/* <CareerSuggestionPage /> */}
            </SuspensedView>
          </RequirePermission>
        } />

        {/* Admin viewing a specific student's dashboard.
            New canonical path: /student/dashboard/view/:studentId
            Legacy /student-dashboard/:studentId kept as redirect below for old links. */}
        <Route path="/student/dashboard/view/:studentId" element={
          <RequirePermission perm="student.read">
            <SuspensedView>
              <StudentDashboard />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route
          path="/student-dashboard/:studentId"
          element={<RedirectStudentDashboard />}
        />

        {/* Student portal — now inside MasterLayout (aside-menu shell), permission-gated.
            All routes moved under /student/dashboard/* to match the new URL scheme.
            Old /student/* paths redirect below for backwards compat. */}
        <Route path="/student/dashboard/student-info" element={
          <SuspensedView>
            <StudentInfoForm />
          </SuspensedView>
        } />
        <Route path="/student/dashboard" element={
          <RequirePermission perm="assessment.read">
            <SuspensedView>
              <StudentPortalDashboard />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/student/dashboard/navigator-360" element={
          <RequirePermission perm="generated_report.read">
            <SuspensedView>
              <StudentPortalNavigator360 />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/student/dashboard/assessments" element={
          <RequirePermission perm="assessment.read">
            <SuspensedView>
              <StudentPortalAssessments />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/student/dashboard/reports" element={
          <RequirePermission perm="generated_report.read">
            <SuspensedView>
              <StudentPortalReports />
            </SuspensedView>
          </RequirePermission>
        } />
        <Route path="/student/dashboard/counselling" element={
          <SuspensedView>
            <StudentCounsellingPage />
          </SuspensedView>
        } />
        <Route path="/student/dashboard/counselling/book" element={
          <SuspensedView>
            <SlotBookingPage />
          </SuspensedView>
        } />

        {/* Backwards-compat redirects: legacy /student/* and /dashboard/student/* paths -> new /student/dashboard/* */}
        <Route path="/student/student-info"       element={<Navigate to="/student/dashboard/student-info" replace />} />
        <Route path="/student/navigator-360"      element={<Navigate to="/student/dashboard/navigator-360" replace />} />
        <Route path="/student/assessments"        element={<Navigate to="/student/dashboard/assessments" replace />} />
        <Route path="/student/reports"            element={<Navigate to="/student/dashboard/reports" replace />} />
        <Route path="/student/counselling"        element={<Navigate to="/student/dashboard/counselling" replace />} />
        <Route path="/student/counselling/book"   element={<Navigate to="/student/dashboard/counselling/book" replace />} />
        <Route path="/dashboard/student"                   element={<Navigate to="/student/dashboard" replace />} />
        <Route path="/dashboard/student/student-info"      element={<Navigate to="/student/dashboard/student-info" replace />} />
        <Route path="/dashboard/student/navigator-360"     element={<Navigate to="/student/dashboard/navigator-360" replace />} />
        <Route path="/dashboard/student/assessments"       element={<Navigate to="/student/dashboard/assessments" replace />} />
        <Route path="/dashboard/student/reports"           element={<Navigate to="/student/dashboard/reports" replace />} />
        <Route path="/dashboard/student/counselling"       element={<Navigate to="/student/dashboard/counselling" replace />} />
        <Route path="/dashboard/student/counselling/book"  element={<Navigate to="/student/dashboard/counselling/book" replace />} />
        <Route path="/dashboard/student/view/:studentId"   element={<RedirectStudentDashboard />} />

        <Route
          path="/student/university/result-dashboard"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <UniversityResultDashboard />
              </SuspensedView>
            </RequirePermission>
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
            <RequirePermission perm="student.read">
              <SuspensedView>
                <ResultPage />
              </SuspensedView>
            </RequirePermission>
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
            <RequirePermission perm="student.write">
              <SuspensedView>
                <CourseBranchBatchPageForm />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/student/registration-details"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <StudentRegistrationDetails />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/faculty/registration-details"
          element={
            <RequirePermission perm="user.read">
              <SuspensedView>
                <FacultyRegistrationDetails />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/faculty/registration-form"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <FacultyRegistrationForm />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/teacher/class-dashboard"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <ClassTeacherDashboard />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/registrar/verification/faculty"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <FacultyRegistrationForm />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/registrar/verification"
          element={
            <RequirePermission perm="student.write">
              <SuspensedView>
                <StudentRegistrationForm />
              </SuspensedView>
            </RequirePermission>
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
            <RequirePermission perm="group.read">
              <SuspensedView>
                <GoogleGroups />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="groups"
          element={
            <RequirePermission perm="group.read">
              <SuspensedView>
                <Groups />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="group"
          element={
            <RequirePermission perm="group.read">
              <SuspensedView>
                <Group />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/old-student-email"
          element={
            <RequirePermission perm="user.read">
              <SuspensedView>
                <OldStudentEmail />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/career"
          element={
            <RequirePermission perm="career.read">
              <SuspensedView>
                <CareerPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/career/create"
          element={
            <RequirePermission perm="career.write">
              <SuspensedView>
                <CareerCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/career/edit/:id"
          element={
            <RequirePermission perm="career.write">
              <SuspensedView>
                <CareerEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/contact-person"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <ContactPersonPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/contact-person/create"
          element={
            <RequirePermission perm="institute.write">
              <SuspensedView>
                <ContactPersonCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/board"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <Board />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/section"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <Section />
              </SuspensedView>
            </RequirePermission>
          }
        />
        {
          <Route
            path="/college"
            element={
              <RequirePermission perm="institute.read">
                <SuspensedView>
                  <College />
                </SuspensedView>
              </RequirePermission>
            }
          />
        }
        <Route
          path="/college/create"
          element={
            <RequirePermission perm="institute.write">
              <SuspensedView>
                <CollegeCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessment-mapping"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentMappingPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/question-sections"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <QuestionSectionPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/question-sections/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionSectionCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/question-sections/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionSectionEditPage />
              </SuspensedView>
            </RequirePermission>
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
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <AssessmentQuestions />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessment-questions/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessment-questions/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessment-questions/duplicates"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionDuplicatesPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/offline-assessment-upload"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <OfflineAssessmentUpload />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/omr-data-upload"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <OMRDataUpload />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/text-response-mapping"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <TextResponseMapping />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/tools"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <Tools />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/tools/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <ToolCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/tools/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <ToolEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/list"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <ListPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/list/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <ListCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/list/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <ListEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/upload-excel"
          element={
            <RequirePermission perm="student.write">
              <SuspensedView>
                <UploadExcelFile />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/demographic-fields"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <DemographicFieldsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/demographic-fields/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <DemographicFieldCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/demographic-fields/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <DemographicFieldEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessments"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <Assessments />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessments/create/step-2"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentToolPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessments/create/step-3"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentUploadFile />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessments/create/step-4"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentSection />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessments/create/step-5"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentQuestion />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/questionare/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionareCreateSinglePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/questionare/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <QuestionareEditSinglePage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/assessments/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/assessments/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AssessmentEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/measured-qualities"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <MeasuredQualities />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/measured-qualities/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <MeasuredQualitiesCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/measured-qualities/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <MeasuredQualitiesEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/measured-quality-types"
          element={
            <RequirePermission perm="assessment.read">
              <SuspensedView>
                <MeasuredQualityTypes />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/measured-quality-types/create"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <MeasuredQualityTypesCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/measured-quality-types/edit/:id"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <MeasuredQualityTypesEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/course"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <Course />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/branch"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <Branch />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/batch"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <Batch />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/session"
          element={
            <RequirePermission perm="institute.read">
              <SuspensedView>
                <Session />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/batchgoogle"
          element={
            <RequirePermission perm="group.write">
              <SuspensedView>
                <BatchGoogle />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/studentlist"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <StudentList />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/studentprofile"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <StudentProfile />
              </SuspensedView>
            </RequirePermission>
          }
        />
        {/* New consolidated pages */}
        <Route
          path="/user-management/roles/manage"
          element={
            <RequirePermission perm="role.assign">
              <SuspensedView>
                <RolesAndPermissionsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/user-management/users/manage"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <UserManagementPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        {/* Old routes — redirect to new pages (destination routes are permission-guarded; do
            NOT wrap a redirect in RequirePermission as it would flash RequestAccessPage). */}
        <Route path="/roles/role" element={<Navigate to="/user-management/roles/manage" replace />} />
        <Route path="/roles/role_roleGroup" element={<Navigate to="/user-management/roles/manage" replace />} />
        <Route path="/roles/roleUser" element={<Navigate to="/user-management/users/manage" replace />} />
        <Route path="/user-registrations" element={<Navigate to="/user-management/users/manage" replace />} />
        <Route path="/roles/users" element={<Navigate to="/user-management/users/manage" replace />} />
        <Route
          path="/reports"
          element={
            <RequirePermission perm="report.read">
              <SuspensedView>
                <ReportsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/bet-report-generation"
          element={
            <RequirePermission perm="report.read">
              <SuspensedView>
                <BetReportGenerationPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/navigator-report-generation"
          element={
            <RequirePermission perm="report.read">
              <SuspensedView>
                <NavigatorReportGenerationPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/unified-report-management"
          element={
            <RequirePermission perm="report.read">
              <SuspensedView>
                <UnifiedReportManagementPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/send-reports"
          element={
            <RequirePermission perm="report.export">
              <SuspensedView>
                <SendReportsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/reports-hub"
          element={
            <RequirePermission perm="report.read">
              <SuspensedView>
                <ReportsHubPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin-assessment-edit/:assessmentId/:studentId"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <AdminAssessmentEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/activity-log"
          element={
            <RequirePermission perm="permission.grant">
              <SuspensedView>
                <ActivityLogPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/live-tracking"
          element={
            <RequirePermission perm="student.read">
              <SuspensedView>
                <LiveTrackingPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/communication-logs"
          element={
            <RequirePermission perm="permission.grant">
              <SuspensedView>
                <CommunicationLogsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/leads"
          element={
            <RequirePermission perm="user.read">
              <SuspensedView>
                <LeadsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/old-data-mapping"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <OldDataMappingPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/score-debug"
          element={
            <RequirePermission perm="assessment.create">
              <SuspensedView>
                <ScoreDebugPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/counsellor/dashboard"
          element={
            <RequirePermission perm="counselling.read">
              <SuspensedView>
                <CounsellorDashboardPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/counsellor/availability"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <AvailabilityManagerPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/counsellor/session-notes/:id"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <SessionNotesPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/counsellors"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <CounsellorManagementPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/counselling-students"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <ManageStudentsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/counselling-slots"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <SlotManagementPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/counselling-notifications"
          element={
            <RequirePermission perm="user.write">
              <SuspensedView>
                <CounsellingNotificationsPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/report-types"
          element={
            <RequirePermission perm="report_type.read">
              <SuspensedView>
                <ReportTypesPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/report-types/create"
          element={
            <RequirePermission perm="report_type.create">
              <SuspensedView>
                <ReportTypesCreatePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/admin/report-types/edit/:id"
          element={
            <RequirePermission perm="report_type.update">
              <SuspensedView>
                <ReportTypesEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />

        <Route
          path="/payment-tracking"
          element={
            <RequirePermission perm="payment.refund">
              <SuspensedView>
                <PaymentTrackingPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/promo-codes"
          element={
            <RequirePermission perm="payment.refund">
              <SuspensedView>
                <PromoCodePage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/b2c/pricing-tiers"
          element={
            <RequirePermission perm="campaign.write">
              <SuspensedView>
                <B2CPricingTierPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/b2c/campaigns"
          element={
            <RequirePermission perm="campaign.read">
              <SuspensedView>
                <B2CCampaignPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/b2c/campaigns/create"
          element={
            <RequirePermission perm="campaign.write">
              <SuspensedView>
                <B2CCampaignEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/b2c/campaigns/edit/:id"
          element={
            <RequirePermission perm="campaign.write">
              <SuspensedView>
                <B2CCampaignEditPage />
              </SuspensedView>
            </RequirePermission>
          }
        />
        <Route
          path="/b2c/tracker"
          element={
            <RequirePermission perm="campaign.read">
              <SuspensedView>
                <B2CTrackerPage />
              </SuspensedView>
            </RequirePermission>
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
