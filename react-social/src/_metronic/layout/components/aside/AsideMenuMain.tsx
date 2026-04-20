/* eslint-disable react/jsx-no-target-blank */
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../../app/modules/auth";
import { AsideMenuItem } from "./AsideMenuItem";
import { AsideMenuItemWithSub } from "./AsideMenuItemWithSub";

/** Check whether a given path is allowed by the user's authorityUrls (supports * wildcards) */
function isUrlAllowed(path: string, authorityUrls: string[]): boolean {
  return authorityUrls.some((pattern) => {
    if (pattern.includes("*")) {
      const regexStr =
        "^" +
        pattern
          .replace(/([.+?^${}()|[\]\\])/g, "\\$1")
          .replace(/\*/g, ".*") +
        "$";
      return new RegExp(regexStr).test(path);
    }
    return path === pattern || path.startsWith(pattern + "/");
  });
}

export function AsideMenuMain() {
  const intl = useIntl();
  const { pathname, search } = useLocation();
  const { currentUser } = useAuth();
  const authorityUrls: string[] = currentUser?.authorityUrls ?? [];
  const isInstituteDashboard = pathname.startsWith("/school/principal/dashboard/");
  const isSchoolPage = pathname.startsWith("/school/");
  const showSchoolGroupStudent = isSchoolPage;
  const showAssignedStudents = isSchoolPage;
  // Resolve institute ID: from path segment on dashboard, from query param on other school pages
  const schoolGroupStudentInstituteId = isInstituteDashboard
    ? (pathname.split('/')[4] || "")
    : (new URLSearchParams(search).get("instituteId") || "");
  const allowed = (path: string) => {
    const normalized = path.startsWith("/") ? path : "/" + path;
    return isUrlAllowed(normalized, authorityUrls);
  };

  // Section visibility: show section header + submenu only if at least one child is allowed
  const showInstitute =
    allowed("/college") || allowed("/contact-person") || allowed("/group-student") ||
    allowed("/admin/group-student") || allowed("/school/group-student") ||
    allowed("/school/assigned-students") ||
    allowed("/board") || allowed("/upload-excel") || allowed("/studentlist");

  const showQuestionnaire =
    allowed("/questionare/create") || allowed("/questionaire/List") ||
    allowed("/tools") || allowed("/game-list");

  const showQualities =
    allowed("/measured-qualities") || allowed("/measured-quality-types");

  const showAssessment =
    allowed("/assessments") || allowed("/assessment-sections") ||
    allowed("/assessment-questions") || allowed("/question-sections") ||
    allowed("/text-response-mapping");

  const showAssessmentManagement = showQuestionnaire || showQualities || showAssessment;

  const showRegistration = allowed("/user-registrations");

  const showDataUpload =
    allowed("/offline-assessment-upload") || allowed("/omr-data-upload") ||
    allowed("/live-tracking") || allowed("/payment-tracking") || allowed("/promo-codes") ||
    allowed("/communication-logs");

  const showReports = allowed("/reports") || allowed("/report-generation") || allowed("/send-reports");

  const showTeacherDashboards =
    allowed("/teacher/class-dashboard") || allowed("/principal/dashboard");

  const showTeacherRegistration =
    allowed("/faculty/registration-details") || allowed("/faculty/registration-form");

  const showTeacher = showTeacherDashboards || showTeacherRegistration;

  const showRoles =
    allowed("/roles/role") ||
    allowed("/roles/role_roleGroup") || allowed("/roles/roleUser") ||
    allowed("/user-registrations");

  const showActivityLog = allowed("/activity-log");
  const showLeads = allowed("/leads");
  const showOldDataMapping = allowed("/old-data-mapping");
  const showScoreDebug = allowed("/score-debug");

  const showCounselling =
    allowed("/admin/counsellors") ||
    allowed("/admin/counselling-slots") || allowed("/admin/counselling-students") || allowed("/admin/counselling-notifications");

  return (
    <>
      <AsideMenuItem
        to="/dashboard"
        icon="/media/icons/duotune/art/art002.svg"
        title={intl.formatMessage({ id: "MENU.DASHBOARD" })}
        fontIcon="bi-app-indicator"
      />

      {showInstitute && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Institute
              </span>
            </div>
          </div>

          <AsideMenuItemWithSub
            to=""
            title="Institute Management"
            fontIcon="bi-app-indicator"
            icon="/media/icons/duotune/communication/com006.svg"
          >
            {allowed("/college") && (
              <AsideMenuItem
                to="/college"
                icon="/media/icons/duotune/general/gen001.svg"
                title="Institute"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/contact-person") && (
              <AsideMenuItem
                to="/contact-person"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Add Contact Person Information"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/group-student") && (
              <AsideMenuItem
                to="/group-student"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Data Download"
                fontIcon="bi-app-indicator"
              />
            )}
            {showSchoolGroupStudent && allowed("/school/group-student") && (
              <AsideMenuItem
                to={`/school/group-student?instituteId=${schoolGroupStudentInstituteId}`}
                icon="/media/icons/duotune/general/gen044.svg"
                title="Group Student Information School"
                fontIcon="bi-app-indicator"
              />
            )}
            {showAssignedStudents && allowed("/school/assigned-students") && (
              <AsideMenuItem
                to={`/school/assigned-students?instituteId=${schoolGroupStudentInstituteId}`}
                icon="/media/icons/duotune/communication/com006.svg"
                title="Assigned Students"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/board") && (
              <AsideMenuItem
                to="/board"
                icon="/media/icons/duotune/finance/fin001.svg"
                title="Board"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/upload-excel") && (
              <AsideMenuItem
                to="/upload-excel"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Add Students in Bulk"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/studentlist") && (
              <AsideMenuItem
                to="/studentlist"
                title="Student's List & Profile"
                fontIcon="bi-app-indicator"
                icon="/media/icons/duotune/communication/com006.svg"
              />
            )}
          </AsideMenuItemWithSub>
        </>
      )}


      {showAssessmentManagement && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Assessment Management
              </span>
            </div>
          </div>

          {showQuestionnaire && (
            <AsideMenuItemWithSub
              to=""
              title="Questionnaire Management"
              fontIcon="bi-app-indicator"
              icon="/media/icons/duotune/communication/com006.svg"
            >
              {allowed("/questionare/create") && (
                <AsideMenuItem
                  to="/questionare/create"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Create Questionnaire"
                  fontIcon="bi-app-indicator"
                />
              )}
              {allowed("/questionaire/List") && (
                <AsideMenuItem
                  to="/questionaire/List"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Questionare List"
                  fontIcon="bi-app-indicator"
                />
              )}
              {allowed("/tools") && (
                <AsideMenuItem
                  to="/tools"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Tools"
                  fontIcon="bi-app-indicator"
                />
              )}
              {allowed("/game-list") && (
                <AsideMenuItem
                  to="/game-list"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Game List"
                  fontIcon="bi-app-indicator"
                />
              )}
            </AsideMenuItemWithSub>
          )}

          {showQualities && (
            <AsideMenuItemWithSub
              to=""
              title="Qualities"
              fontIcon="bi-app-indicator"
              icon="/media/icons/duotune/communication/com006.svg"
            >
              {allowed("/measured-qualities") && (
                <AsideMenuItem
                  to="/measured-qualities"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Measured Qualities"
                  fontIcon="bi-app-indicator"
                />
              )}
              {allowed("/measured-quality-types") && (
                <AsideMenuItem
                  to="/measured-quality-types"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Measured Quality Types"
                  fontIcon="bi-app-indicator"
                />
              )}
            </AsideMenuItemWithSub>
          )}

          {showAssessment && (
            <AsideMenuItemWithSub
              to=""
              title="Assessment Section"
              fontIcon="bi-app-indicator"
              icon="/media/icons/duotune/communication/com006.svg"
            >
              {allowed("/assessments") && (
                <AsideMenuItem
                  to="/assessments"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Assessments"
                  fontIcon="bi-app-indicator"
                />
              )}
              {allowed("/assessment-questions") && (
                <AsideMenuItem
                  to="/assessment-questions"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Assessment Questions"
                  fontIcon="bi-app-indicator"
                />
              )}
              {allowed("/question-sections") && (
                <AsideMenuItem
                  to="/question-sections"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Assessment Sections"
                  fontIcon="bi-app-indicator"
                />
              )}
              <AsideMenuItem
                to="/demographic-fields"
                icon="/media/icons/duotune/general/gen019.svg"
                title="Demographic Fields"
                fontIcon="bi-app-indicator"
              />
              {allowed("/text-response-mapping") && (
                <AsideMenuItem
                  to="/text-response-mapping"
                  icon="/media/icons/duotune/general/gen005.svg"
                  title="Text Response Mapping"
                  fontIcon="bi-card-text"
                />
              )}
            </AsideMenuItemWithSub>
          )}
        </>
      )}

      {showDataUpload && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Data Upload & Tracking
              </span>
            </div>
          </div>

          <AsideMenuItemWithSub
            to=""
            title="Upload & Tracking"
            fontIcon="bi-cloud-upload"
            icon="/media/icons/duotune/files/fil003.svg"
          >
            {allowed("/offline-assessment-upload") && (
              <AsideMenuItem
                to="/offline-assessment-upload"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Offline Upload"
                fontIcon="bi-cloud-upload"
              />
            )}
            {allowed("/omr-data-upload") && (
              <AsideMenuItem
                to="/omr-data-upload"
                icon="/media/icons/duotune/general/gen044.svg"
                title="OMR Data Upload"
                fontIcon="bi-upc-scan"
              />
            )}
            {allowed("/live-tracking") && (
              <AsideMenuItem
                to="/live-tracking"
                icon="/media/icons/duotune/general/gen019.svg"
                title="Live Tracking"
                fontIcon="bi-broadcast"
              />
            )}
            {allowed("/communication-logs") && (
              <AsideMenuItem
                to="/communication-logs"
                icon="/media/icons/duotune/communication/com007.svg"
                title="Logs of Email and WhatsApp"
                fontIcon="bi-envelope-paper"
              />
            )}
            {allowed("/payment-tracking") && (
              <AsideMenuItem
                to="/payment-tracking"
                icon="/media/icons/duotune/finance/fin002.svg"
                title="Payment Tracking"
                fontIcon="bi-credit-card"
              />
            )}
            {allowed("/promo-codes") && (
              <AsideMenuItem
                to="/promo-codes"
                icon="/media/icons/duotune/ecommerce/ecm001.svg"
                title="Promo Codes"
                fontIcon="bi-tag"
              />
            )}
          </AsideMenuItemWithSub>
        </>
      )}

      {showReports && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Reports
              </span>
            </div>
          </div>

          {allowed("/reports") && (
            <AsideMenuItem
              to="/reports-hub"
              icon="/media/icons/duotune/graphs/gra010.svg"
              title="Reports Hub"
              fontIcon="bi-grid-3x3-gap"
            />
          )}
          {/* {allowed("/reports") && (
            <AsideMenuItem
              to="/reports"
              icon="/media/icons/duotune/files/fil003.svg"
              title="Unified Score Export"
              fontIcon="bi-file-earmark-text"
            />
          )}
          {allowed("/reports") && (
            <AsideMenuItem
              to="/bet-report-generation"
              icon="/media/icons/duotune/general/gen005.svg"
              title="BET Report Generation"
              fontIcon="bi-file-earmark-bar-graph"
            />
          )}
          {allowed("/reports") && (
            <AsideMenuItem
              to="/navigator-report-generation"
              icon="/media/icons/duotune/maps/map001.svg"
              title="Navigator Report Generation"
              fontIcon="bi-compass"
            />
          )}
          {allowed("/reports") && (
            <AsideMenuItem
              to="/unified-report-management"
              icon="/media/icons/duotune/graphs/gra010.svg"
              title="Unified Report Management"
              fontIcon="bi-grid-3x3-gap"
            />
          )}
          {(allowed("/reports") || allowed("/send-reports")) && (
            <AsideMenuItem
              to="/send-reports"
              icon="/media/icons/duotune/general/gen016.svg"
              title="Send Reports"
              fontIcon="bi-envelope"
            />
          )} */}
        </>
      )}

      {/* <AsideMenuItem
        to="/student/university/result-list"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Students University Result"
        fontIcon="bi-app-indicator"
      /> */}

      {/* <AsideMenuItem
        to="/student/university/result-dashboard"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Students University Dashboard"
        fontIcon="bi-app-indicator"
      /> */}

      {/* <AsideMenuItem
        to="/student/university/all-result-dashboard"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Students Result By Rollno Dashboard"
        fontIcon="bi-app-indicator"
      /> */}

      {/* <AsideMenuItem
        to="forgotpassword"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Reset Password"
        fontIcon="bi-app-indicator"
      /> */}

      {/* <AsideMenuItem
        to="google-groups"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Google Groups"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="groups"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Groups"
        fontIcon="bi-app-indicator"
      /> */}

      {/* <AsideMenuItem
        to="group"
        icon="/media/icons/duotune/communication/com014.svg"
        title="Group"
        fontIcon="bi-app-indicator"
      /> */}

      {showTeacher && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                TEACHER
              </span>
            </div>
          </div>
          {showTeacherDashboards && (
            <AsideMenuItemWithSub
              to=""
              title="Dashboards"
              fontIcon="bi-speedometer2"
              icon="/media/icons/duotune/general/gen019.svg"
            >
              {allowed("/teacher/class-dashboard") && (
                <AsideMenuItem
                  to="/teacher/class-dashboard"
                  title="Class Teacher Dashboard"
                  hasBullet={true}
                />
              )}
              {allowed("/principal/dashboard") && (
                <AsideMenuItem
                  to="/principal/dashboard"
                  title="Principal Dashboard"
                  hasBullet={true}
                />
              )}
            </AsideMenuItemWithSub>
          )}
          {showTeacherRegistration && (
            <AsideMenuItemWithSub
              to=""
              title="Teachers Registration"
              fontIcon="bi-app-indicator"
              icon="/media/icons/duotune/communication/com006.svg"
            >
              {allowed("/faculty/registration-details") && (
                <AsideMenuItem
                  to="/faculty/registration-details"
                  title="Registrations List"
                  hasBullet={true}
                />
              )}
              {allowed("/faculty/registration-form") && (
                <AsideMenuItem
                  to="/faculty/registration-form"
                  title="Registration Form"
                  hasBullet={true}
                />
              )}
            </AsideMenuItemWithSub>
          )}
        </>
      )}

      {showRoles && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                ROLES
              </span>
            </div>
          </div>
          <AsideMenuItemWithSub
            to=""
            title="Roles and Users"
            fontIcon="bi-shield-lock"
            icon="/media/icons/duotune/general/gen019.svg"
          >
            {(allowed("/roles/role") || allowed("/roles/role_roleGroup")) && (
              <AsideMenuItem
                to="/user-management/roles/manage"
                title="Roles & Permissions"
                hasBullet={true}
              />
            )}
            {(allowed("/roles/roleUser") || allowed("/user-registrations")) && (
              <AsideMenuItem
                to="/user-management/users/manage"
                title="User Management"
                hasBullet={true}
              />
            )}
          </AsideMenuItemWithSub>
        </>
      )}


      {showActivityLog && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                ADMIN
              </span>
            </div>
          </div>
          <AsideMenuItem
            to="/activity-log"
            icon="/media/icons/duotune/general/gen019.svg"
            title="Activity Log"
            fontIcon="bi-journal-text"
          />
        </>
      )}
      {showLeads && (
        <AsideMenuItem
          to="/leads"
          icon="/media/icons/duotune/communication/com005.svg"
          title="Leads"
          fontIcon="bi-people"
        />
      )}

      {showOldDataMapping && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Firebase Data Mapping
              </span>
            </div>
          </div>
          <AsideMenuItem
            to="/old-data-mapping"
            icon="/media/icons/duotune/general/gen022.svg"
            title="Firebase Data Mapping"
            fontIcon="bi-arrow-left-right"
          />
        </>
      )}

      {showScoreDebug && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Debugging
              </span>
            </div>
          </div>
          <AsideMenuItem
            to="/score-debug"
            icon="/media/icons/duotune/general/gen031.svg"
            title="Score Debug"
            fontIcon="bi-bug"
          />
        </>
      )}

      {showCounselling && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Counselling
              </span>
            </div>
          </div>
          <AsideMenuItemWithSub
            to="/counselling"
            title="Counselling"
            fontIcon="bi-app-indicator"
            icon="/media/icons/duotune/general/gen049.svg"
          >
            {allowed("/admin/counsellors") && (
              <AsideMenuItem to="/admin/counsellors" title="Manage Counsellors" hasBullet={true} />
            )}
            {allowed("/admin/counselling-students") && (
              <AsideMenuItem to="/admin/counselling-students" title="Manage Students" hasBullet={true} />
            )}
            {allowed("/admin/counselling-slots") && (
              <AsideMenuItem to="/admin/counselling-slots" title="Create Slots" hasBullet={true} />
            )}
            {allowed("/admin/counselling-notifications") && (
              <AsideMenuItem to="/admin/counselling-notifications" title="Notifications" hasBullet={true} />
            )}
          </AsideMenuItemWithSub>
        </>
      )}
    </>
  );
}
