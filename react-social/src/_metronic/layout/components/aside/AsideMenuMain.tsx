/* eslint-disable react/jsx-no-target-blank */
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../app/modules/auth";
import { urlAllowed } from "../../../../app/modules/auth/core/permissions";
import { AsideMenuItem } from "./AsideMenuItem";
import { AsideMenuItemWithSub } from "./AsideMenuItemWithSub";

/**
 * Phase 5 (Task 5.1): the aside menu is now driven by the role group's allowed-URL whitelist
 * (the `urls[]` delivered by GET /auth/me), NOT by permission codes. An item is shown iff its
 * destination path is in the user's URL whitelist — exactly the same signal the route guard
 * (RequirePermission) uses — so the menu and the route guard can no longer disagree (a user
 * never sees a menu item that then bounces them to RequestAccessPage). Super-admins bypass the
 * whitelist and see everything. The Student Portal section stays role-gated because the student
 * app uses a role-string guard (StudentAuthGuard), not the admin URL whitelist.
 */
export function AsideMenuMain() {
  const intl = useIntl();
  const { pathname, search } = useLocation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser?.superAdmin === true;

  // Counsellor sign-out (the counsellor shell has no top header/avatar menu, so
  // logout lives at the bottom of the sidebar instead). Await logout so the session
  // (currentUser) is cleared BEFORE navigating — otherwise "/auth" would bounce to
  // "/dashboard" while still authenticated. Lands on the main Staff/Student sign-in.
  const handleCounsellorLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  // An item/section is visible iff its path is in the role group's allowed-URL list
  // (super-admins see everything). Query strings are stripped — the whitelist is path-based.
  const allowed = (path: string): boolean => {
    if (isSuperAdmin) return true;
    const bare = path.split("?")[0];
    return urlAllowed(currentUser?.urls, bare);
  };

  // Path-context flags (routing state, not authorization — preserved from the
  // pre-permission-aware menu so the institute-dashboard nested links still work):
  const isInstituteDashboard = pathname.startsWith("/school/principal/dashboard/");
  const isSchoolPage = pathname.startsWith("/school/");
  const showSchoolGroupStudent = isSchoolPage;
  const showAssignedStudents = isSchoolPage;
  // Resolve institute ID: from path segment on dashboard, from query param on other school pages
  const schoolGroupStudentInstituteId = isInstituteDashboard
    ? (pathname.split('/')[4] || "")
    : (new URLSearchParams(search).get("instituteId") || "");

  // Section-visibility flags — a section header is shown iff at least one of its child menu
  // items is in the user's URL whitelist. The path list per section MUST match the child
  // AsideMenuItem `to` values below.
  const showInstitute =
    allowed("/college") ||
    allowed("/contact-person") ||
    allowed("/group-student") ||
    allowed("/student-management") ||
    allowed("/student-list") ||
    allowed("/board") ||
    allowed("/upload-excel") ||
    allowed("/assessment-mapping");

  const showQuestionnaire =
    allowed("/questionare/create") ||
    allowed("/questionaire/List") ||
    allowed("/tools") ||
    allowed("/game-list");

  const showQualities =
    allowed("/measured-qualities") ||
    allowed("/measured-quality-types");

  const showAssessment =
    allowed("/assessments") ||
    allowed("/assessment-questions") ||
    allowed("/question-sections") ||
    allowed("/demographic-fields") ||
    allowed("/text-response-mapping");

  const showAssessmentManagement = showQuestionnaire || showQualities || showAssessment;

  const showDataUpload =
    allowed("/offline-assessment-upload") ||
    allowed("/omr-data-upload") ||
    allowed("/live-tracking") ||
    allowed("/communication-logs");

  const showB2C =
    allowed("/b2c/campaigns") ||
    allowed("/b2c/pricing-tiers") ||
    allowed("/b2c/tracker") ||
    allowed("/payment-tracking") ||
    allowed("/promo-codes") ||
    allowed("/referral-codes");

  const showReports = allowed("/reports") || allowed("/reports-hub") || allowed("/admin/report-templates");

  const showRoles =
    allowed("/user-management/roles/manage") ||
    allowed("/user-management/users/manage");

  const showActivityLog = allowed("/activity-log");
  // JWT Token console is super-admin-only — backend enforces via @PreAuthorize("principal.superAdmin")
  const showJwtTokens = isSuperAdmin;
  const showEmailAccounts = allowed("/admin/email-accounts");
  const showEmailLog = allowed("/admin/email-log");
  const showEmail = showEmailAccounts || showEmailLog;
  const showLeads = allowed("/leads");
  const showOldDataMapping = allowed("/old-data-mapping");
  const showScoreDebug = allowed("/score-debug");

  const showTeacherDashboards =
    allowed("/teacher/class-dashboard") || allowed("/principal/dashboard");

  const showCounselling =
    allowed("/admin/counselling-dashboard") ||
    allowed("/admin/counsellors") ||
    allowed("/admin/counselling-students") ||
    allowed("/admin/counselling-slots") ||
    allowed("/admin/counselling-notifications");

  // Student Portal section — role-gated (the student app uses StudentAuthGuard, not the admin
  // URL whitelist). Shown for users holding a student role, or for super admins.
  const userRoles = currentUser?.roles ?? [];
  const showStudentPortal =
    isSuperAdmin ||
    userRoles.some(
      (r) => r === "STUDENT" || r === "B2C_STUDENT" || r === "ROLE_STUDENT" || r === "ROLE_B2C_STUDENT"
    );

  const showCounsellorPortal =
    isSuperAdmin ||
    // Case-insensitive: the DB role is named 'Counsellor', not 'COUNSELLOR'.
    userRoles.some((r) => {
      const u = typeof r === "string" ? r.toUpperCase() : "";
      return u === "COUNSELLOR" || u === "ROLE_COUNSELLOR";
    });

  // A pure COUNSELLOR (not also a super-admin) sees ONLY the counsellor portal menu —
  // none of the admin sections. The pages render inside this same admin shell, so the
  // counsellor gets the unified UI but a focused, counsellor-only navigation.
  const isCounsellorOnly =
    !isSuperAdmin &&
    userRoles.some((r) => {
      const u = typeof r === "string" ? r.toUpperCase() : "";
      return u === "COUNSELLOR" || u === "ROLE_COUNSELLOR";
    });

  if (isCounsellorOnly) {
    return (
      <>
        <div className="menu-item">
          <div className="menu-content pt-8 pb-2">
            <span className="menu-section text-muted text-uppercase fs-8 ls-1">
              Counsellor
            </span>
          </div>
        </div>
        <AsideMenuItem to="/counsellor/dashboard" title="Dashboard" icon="/media/icons/duotune/art/art002.svg" fontIcon="bi-grid" />
        <AsideMenuItem to="/counsellor/appointments" title="Appointments" icon="/media/icons/duotune/general/gen019.svg" fontIcon="bi-calendar-check" />
        <AsideMenuItem to="/counsellor/notes" title="Session Notes" icon="/media/icons/duotune/files/fil003.svg" fontIcon="bi-journal-text" />
        <AsideMenuItem to="/counsellor/availability" title="Availability" icon="/media/icons/duotune/general/gen005.svg" fontIcon="bi-clock" />
        <AsideMenuItem to="/counsellor/profile" title="My Profile" icon="/media/icons/duotune/communication/com006.svg" fontIcon="bi-person" />

        {/* Sign out — pinned to the bottom of the counsellor sidebar */}
        <div className="menu-item" style={{ marginTop: "auto" }}>
          <div className="menu-content">
            <div className="separator separator-dashed my-2" />
          </div>
        </div>
        <div className="menu-item">
          <a className="menu-link" style={{ cursor: "pointer" }} onClick={handleCounsellorLogout}>
            <span className="menu-icon">
              <i className="bi bi-box-arrow-right fs-3" />
            </span>
            <span className="menu-title">Sign Out</span>
          </a>
        </div>
      </>
    );
  }

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
            {allowed("/reminders") && (
              <AsideMenuItem
                to="/reminders"
                icon="/media/icons/duotune/communication/com003.svg"
                title="Reminders"
                fontIcon="bi-bell"
              />
            )}
            {allowed("/student-management") && (
              <AsideMenuItem
                to="/student-management"
                icon="/media/icons/duotune/general/gen049.svg"
                title="Student Management"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/student-list") && (
              <AsideMenuItem
                to="/student-list"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Student List"
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
                title="Upload Students"
                fontIcon="bi-app-indicator"
              />
            )}
            {allowed("/assessment-mapping") && (
              <AsideMenuItem
                to="/assessment-mapping"
                icon="/media/icons/duotune/general/gen001.svg"
                title="Assessment Mapping"
                fontIcon="bi-app-indicator"
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
              {allowed("/demographic-fields") && (
                <AsideMenuItem
                  to="/demographic-fields"
                  icon="/media/icons/duotune/general/gen019.svg"
                  title="Demographic Fields"
                  fontIcon="bi-app-indicator"
                />
              )}
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
          </AsideMenuItemWithSub>
        </>
      )}

      {showB2C && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                B2C Portal
              </span>
            </div>
          </div>
          <AsideMenuItemWithSub
            to="/b2c"
            title="B2C"
            fontIcon="bi-shop"
            icon="/media/icons/duotune/ecommerce/ecm001.svg"
          >
            {allowed("/b2c/campaigns") && (
              <AsideMenuItem
                to="/b2c/campaigns"
                icon="/media/icons/duotune/ecommerce/ecm005.svg"
                title="Campaigns"
                fontIcon="bi-megaphone"
              />
            )}
            {allowed("/b2c/pricing-tiers") && (
              <AsideMenuItem
                to="/b2c/pricing-tiers"
                icon="/media/icons/duotune/finance/fin010.svg"
                title="Pricing Tiers"
                fontIcon="bi-tag-fill"
              />
            )}
            {allowed("/b2c/tracker") && (
              <AsideMenuItem
                to="/b2c/tracker"
                icon="/media/icons/duotune/graphs/gra007.svg"
                title="Payments & Allotments"
                fontIcon="bi-clipboard-data"
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
            {allowed("/referral-codes") && (
              <AsideMenuItem
                to="/referral-codes"
                icon="/media/icons/duotune/communication/com014.svg"
                title="Referral Codes"
                fontIcon="bi-people"
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

          {allowed("/reports-hub") && (
            <AsideMenuItem
              to="/reports-hub"
              icon="/media/icons/duotune/graphs/gra010.svg"
              title="Reports Hub"
              fontIcon="bi-grid-3x3-gap"
            />
          )}
          {(allowed("/admin/report-templates") || allowed("/reports-hub")) && (
            <AsideMenuItem
              to="/admin/report-templates"
              icon="/media/icons/duotune/files/fil003.svg"
              title="Report Templates"
              fontIcon="bi-file-earmark-text"
            />
          )}
          {allowed("/reports") && (
            <AsideMenuItem
              to="/reports"
              icon="/media/icons/duotune/graphs/gra010.svg"
              title="School Reports"
              fontIcon="bi-mortarboard"
            />
          )}
          {allowed("/school-admin/cohort-insights") && (
            <AsideMenuItem
              to="/school-admin/cohort-insights"
              icon="/media/icons/duotune/graphs/gra007.svg"
              title="Cohort Insights"
              fontIcon="bi-bar-chart"
            />
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
            {allowed("/user-management/roles/manage") && (
              <AsideMenuItem
                to="/user-management/roles/manage"
                title="Roles & Permissions"
                hasBullet={true}
              />
            )}
            {allowed("/user-management/users/manage") && (
              <AsideMenuItem
                to="/user-management/users/manage"
                title="User Management"
                hasBullet={true}
              />
            )}
          </AsideMenuItemWithSub>
        </>
      )}


      {(showActivityLog || showJwtTokens || showEmail) && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                ADMIN
              </span>
            </div>
          </div>
          {allowed("/activity-log") && (
            <AsideMenuItem
              to="/activity-log"
              icon="/media/icons/duotune/general/gen019.svg"
              title="Activity Log"
              fontIcon="bi-journal-text"
            />
          )}
          {showJwtTokens && (
            <AsideMenuItem
              to="/admin/jwt-tokens"
              icon="/media/icons/duotune/general/gen047.svg"
              title="JWT Tokens"
              fontIcon="bi-shield-lock"
            />
          )}
          {showEmail && (
            <AsideMenuItemWithSub
              to=""
              title="Email"
              fontIcon="bi-envelope"
              icon="/media/icons/duotune/communication/com010.svg"
            >
              {showEmailAccounts && (
                <AsideMenuItem
                  to="/admin/email-accounts"
                  icon="/media/icons/duotune/communication/com011.svg"
                  title="Email Accounts"
                  fontIcon="bi-envelope-at"
                />
              )}
              {showEmailLog && (
                <AsideMenuItem
                  to="/admin/email-log"
                  icon="/media/icons/duotune/communication/com007.svg"
                  title="Email Log"
                  fontIcon="bi-envelope-paper"
                />
              )}
            </AsideMenuItemWithSub>
          )}
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

      {showTeacherDashboards && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Teacher
              </span>
            </div>
          </div>
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
            {allowed("/admin/counselling-dashboard") && (
              <AsideMenuItem to="/admin/counselling-dashboard" title="Dashboard" hasBullet={true} />
            )}
            {allowed("/admin/counsellors") && (
              <AsideMenuItem to="/admin/counsellors" title="Manage Counsellors" hasBullet={true} />
            )}
            {allowed("/admin/counselling-students") && (
              <AsideMenuItem to="/admin/counselling-students" title="Manage Students" hasBullet={true} />
            )}
            {allowed("/admin/counselling-slots") && (
              <AsideMenuItem to="/admin/counselling-slots" title="Create Slots" hasBullet={true} />
            )}
            {allowed("/admin/counselling-assignments") && (
              <AsideMenuItem to="/admin/counselling-assignments" title="Assessment Assignments" hasBullet={true} />
            )}
            {allowed("/admin/counselling-notifications") && (
              <AsideMenuItem to="/admin/counselling-notifications" title="Notifications" hasBullet={true} />
            )}
          </AsideMenuItemWithSub>
        </>
      )}

      {showStudentPortal && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Student Portal
              </span>
            </div>
          </div>
          <AsideMenuItemWithSub
            to="/student/dashboard"
            title="Student Portal"
            fontIcon="bi-app-indicator"
            icon="/media/icons/duotune/general/gen049.svg"
          >
            <AsideMenuItem to="/student/dashboard" title="Dashboard" hasBullet={true} />
            <AsideMenuItem to="/student/dashboard/student-info" title="My Info" hasBullet={true} />
            <AsideMenuItem to="/student/dashboard/navigator-360" title="Navigator 360" hasBullet={true} />
            <AsideMenuItem to="/student/dashboard/assessments" title="My Assessments" hasBullet={true} />
            <AsideMenuItem to="/student/dashboard/reports" title="My Reports" hasBullet={true} />
            <AsideMenuItem to="/student/dashboard/counselling" title="Counselling" hasBullet={true} />
          </AsideMenuItemWithSub>
        </>
      )}

      {showCounsellorPortal && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Counsellor Portal
              </span>
            </div>
          </div>
          <AsideMenuItemWithSub
            to="/counsellor/dashboard"
            title="Counsellor Portal"
            fontIcon="bi-app-indicator"
            icon="/media/icons/duotune/general/gen049.svg"
          >
            <AsideMenuItem to="/counsellor/dashboard" title="Dashboard" hasBullet={true} />
            <AsideMenuItem to="/counsellor/appointments" title="Appointments" hasBullet={true} />
            <AsideMenuItem to="/counsellor/notes" title="Session Notes" hasBullet={true} />
            <AsideMenuItem to="/counsellor/availability" title="Availability" hasBullet={true} />
            <AsideMenuItem to="/counsellor/profile" title="Profile" hasBullet={true} />
          </AsideMenuItemWithSub>
        </>
      )}
    </>
  );
}
