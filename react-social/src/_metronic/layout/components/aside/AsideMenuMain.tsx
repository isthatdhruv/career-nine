/* eslint-disable react/jsx-no-target-blank */
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import { useCan, Can, useAuth } from "../../../../app/modules/auth";
import { AsideMenuItem } from "./AsideMenuItem";
import { AsideMenuItemWithSub } from "./AsideMenuItemWithSub";

export function AsideMenuMain() {
  const intl = useIntl();
  const { pathname, search } = useLocation();
  const can = useCan();
  const { currentUser } = useAuth();
  // Path-context flags (routing state, not authorization — preserved from
  // the pre-permission-aware menu so the institute-dashboard nested links
  // still work):
  const isInstituteDashboard = pathname.startsWith("/school/principal/dashboard/");
  const isSchoolPage = pathname.startsWith("/school/");
  const showSchoolGroupStudent = isSchoolPage;
  const showAssignedStudents = isSchoolPage;
  // Resolve institute ID: from path segment on dashboard, from query param on other school pages
  const schoolGroupStudentInstituteId = isInstituteDashboard
    ? (pathname.split('/')[4] || "")
    : (new URLSearchParams(search).get("instituteId") || "");

  // Section-visibility flags — a section header is shown iff at least one
  // of its child menu items is allowed for this user. Codes mirror Plan 17-02
  // route guards; the menu code and the route guard MUST agree on every
  // (menu item ↔ destination route) pair.

  // Institute section — children: /college, /contact-person, /group-student,
  //   /school/group-student, /school/assigned-students, /board, /upload-excel,
  //   /assessment-mapping.
  const showInstitute =
    can("institute.read") ||      // /college, /contact-person, /board
    can("student.read") ||         // /group-student, /school/group-student, /school/assigned-students
    can("student.write") ||        // /upload-excel
    can("assessment.create") ||     // /assessment-mapping
    can("institute.write");        // /contact-person/create (covered by parent in route, but kept here for completeness)

  // Questionnaire submenu — children: /questionare/create, /questionaire/List, /tools, /game-list.
  const showQuestionnaire =
    can("assessment.read") ||      // /questionaire/List, /tools, /game-list
    can("assessment.create");       // /questionare/create

  // Qualities submenu — children: /measured-qualities, /measured-quality-types.
  const showQualities =
    can("assessment.read") ||      // /measured-qualities, /measured-quality-types
    can("assessment.create");

  // Assessment Section submenu — children: /assessments, /assessment-questions,
  //   /question-sections, /demographic-fields, /text-response-mapping.
  const showAssessment =
    can("assessment.read") ||
    can("assessment.create");

  const showAssessmentManagement = showQuestionnaire || showQualities || showAssessment;

  // Data Upload & Tracking — children: /offline-assessment-upload, /omr-data-upload,
  //   /live-tracking, /communication-logs, /payment-tracking, /promo-codes.
  const showDataUpload =
    can("assessment.create") ||     // /offline-assessment-upload, /omr-data-upload
    can("student.read") ||          // /live-tracking
    can("permission.grant") ||            // /communication-logs
    can("payment.refund") ||          // /payment-tracking
    can("payment.refund");           // /promo-codes

  // Reports section — children: /reports-hub.
  const showReports = can("report.read");

  // Roles & Users — children: /user-management/roles/manage (role.assign),
  //   /user-management/users/manage (user.write).
  const showRoles =
    can("role.assign") ||
    can("role.update") ||
    can("user.write") ||
    can("user.read");

  // Standalone items.
  const showActivityLog = can("permission.grant");
  const showLeads = can("user.read");
  // TODO(product): confirm permission for /old-data-mapping (Firebase Data Mapping)
  const showOldDataMapping = can("assessment.create");
  // TODO(product): confirm permission for /score-debug (Score Debug tool)
  const showScoreDebug = can("assessment.create");

  // Counselling submenu — children: /admin/counsellors, /admin/counselling-students,
  //   /admin/counselling-slots, /admin/counselling-notifications.
  const showCounselling = can("user.write");

  // Student Portal section — show for users who actually hold a student
  // role (matches the StudentRoutes guard at routing/StudentRoutes.tsx) OR
  // for super admins, who need visibility into both student- and school-facing
  // surfaces. A regular school admin like dhruv.kccsw@gmail.com (mapped to KVS)
  // still shouldn't see student-facing menu entries on their console.
  const userRoles = currentUser?.roles ?? [];
  const isSuperAdmin = currentUser?.superAdmin === true;
  const showStudentPortal =
    isSuperAdmin ||
    userRoles.some(
      (r) => r === "STUDENT" || r === "B2C_STUDENT" || r === "ROLE_STUDENT" || r === "ROLE_B2C_STUDENT"
    );

  // B2C Portal — children: /b2c/campaigns, /b2c/pricing-tiers, /b2c/tracker.
  const showB2C = can("campaign.read") || can("campaign.write");

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
            <Can perm="institute.read">
              <AsideMenuItem
                to="/college"
                icon="/media/icons/duotune/general/gen001.svg"
                title="Institute"
                fontIcon="bi-app-indicator"
              />
            </Can>
            <Can perm="institute.read">
              <AsideMenuItem
                to="/contact-person"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Add Contact Person Information"
                fontIcon="bi-app-indicator"
              />
            </Can>
            <Can perm="student.read">
              <AsideMenuItem
                to="/group-student"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Data Download"
                fontIcon="bi-app-indicator"
              />
            </Can>
            <Can perm="student_management.read">
              <AsideMenuItem
                to="/student-management"
                icon="/media/icons/duotune/general/gen049.svg"
                title="Student Management"
                fontIcon="bi-app-indicator"
              />
            </Can>
            <Can perm="student.read">
              <AsideMenuItem
                to="/student-list"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Student List"
                fontIcon="bi-app-indicator"
              />
            </Can>
            {showSchoolGroupStudent && (
              <Can perm="student.read">
                <AsideMenuItem
                  to={`/school/group-student?instituteId=${schoolGroupStudentInstituteId}`}
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Group Student Information School"
                  fontIcon="bi-app-indicator"
                />
              </Can>
            )}
            {showAssignedStudents && (
              <Can perm="student.read">
                <AsideMenuItem
                  to={`/school/assigned-students?instituteId=${schoolGroupStudentInstituteId}`}
                  icon="/media/icons/duotune/communication/com006.svg"
                  title="Assigned Students"
                  fontIcon="bi-app-indicator"
                />
              </Can>
            )}
            <Can perm="institute.read">
              <AsideMenuItem
                to="/board"
                icon="/media/icons/duotune/finance/fin001.svg"
                title="Board"
                fontIcon="bi-app-indicator"
              />
            </Can>
            <Can perm="student.write">
              <AsideMenuItem
                to="/upload-excel"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Upload Students"
                fontIcon="bi-app-indicator"
              />
            </Can>
            <Can perm="assessment.create">
              <AsideMenuItem
                to="/assessment-mapping"
                icon="/media/icons/duotune/general/gen001.svg"
                title="Assessment Mapping"
                fontIcon="bi-app-indicator"
              />
            </Can>
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
              <Can perm="assessment.create">
                <AsideMenuItem
                  to="/questionare/create"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Create Questionnaire"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/questionaire/List"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Questionare List"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/tools"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Tools"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              {/* TODO(product): confirm permission for /game-list — not in 17-02 route table; mapped to assessment.read here. */}
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/game-list"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Game List"
                  fontIcon="bi-app-indicator"
                />
              </Can>
            </AsideMenuItemWithSub>
          )}

          {showQualities && (
            <AsideMenuItemWithSub
              to=""
              title="Qualities"
              fontIcon="bi-app-indicator"
              icon="/media/icons/duotune/communication/com006.svg"
            >
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/measured-qualities"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Measured Qualities"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/measured-quality-types"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Measured Quality Types"
                  fontIcon="bi-app-indicator"
                />
              </Can>
            </AsideMenuItemWithSub>
          )}

          {showAssessment && (
            <AsideMenuItemWithSub
              to=""
              title="Assessment Section"
              fontIcon="bi-app-indicator"
              icon="/media/icons/duotune/communication/com006.svg"
            >
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/assessments"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Assessments"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/assessment-questions"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Assessment Questions"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/question-sections"
                  icon="/media/icons/duotune/general/gen044.svg"
                  title="Assessment Sections"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              {/* TODO(product): /demographic-fields was always-shown today; wrapped in assessment.read for consistency. Confirm whether this should remain universally visible. */}
              <Can perm="assessment.read">
                <AsideMenuItem
                  to="/demographic-fields"
                  icon="/media/icons/duotune/general/gen019.svg"
                  title="Demographic Fields"
                  fontIcon="bi-app-indicator"
                />
              </Can>
              <Can perm="assessment.create">
                <AsideMenuItem
                  to="/text-response-mapping"
                  icon="/media/icons/duotune/general/gen005.svg"
                  title="Text Response Mapping"
                  fontIcon="bi-card-text"
                />
              </Can>
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
            <Can perm="assessment.create">
              <AsideMenuItem
                to="/offline-assessment-upload"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Offline Upload"
                fontIcon="bi-cloud-upload"
              />
            </Can>
            <Can perm="assessment.create">
              <AsideMenuItem
                to="/omr-data-upload"
                icon="/media/icons/duotune/general/gen044.svg"
                title="OMR Data Upload"
                fontIcon="bi-upc-scan"
              />
            </Can>
            <Can perm="student.read">
              <AsideMenuItem
                to="/live-tracking"
                icon="/media/icons/duotune/general/gen019.svg"
                title="Live Tracking"
                fontIcon="bi-broadcast"
              />
            </Can>
            <Can perm="permission.grant">
              <AsideMenuItem
                to="/communication-logs"
                icon="/media/icons/duotune/communication/com007.svg"
                title="Logs of Email and WhatsApp"
                fontIcon="bi-envelope-paper"
              />
            </Can>
            <Can perm="payment.refund">
              <AsideMenuItem
                to="/payment-tracking"
                icon="/media/icons/duotune/finance/fin002.svg"
                title="Payment Tracking"
                fontIcon="bi-credit-card"
              />
            </Can>
            <Can perm="payment.refund">
              <AsideMenuItem
                to="/promo-codes"
                icon="/media/icons/duotune/ecommerce/ecm001.svg"
                title="Promo Codes"
                fontIcon="bi-tag"
              />
            </Can>
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
            <Can perm="campaign.read">
              <AsideMenuItem
                to="/b2c/campaigns"
                icon="/media/icons/duotune/ecommerce/ecm005.svg"
                title="Campaigns"
                fontIcon="bi-megaphone"
              />
            </Can>
            <Can perm="campaign.write">
              <AsideMenuItem
                to="/b2c/pricing-tiers"
                icon="/media/icons/duotune/finance/fin010.svg"
                title="Pricing Tiers"
                fontIcon="bi-tag-fill"
              />
            </Can>
            <Can perm="campaign.read">
              <AsideMenuItem
                to="/b2c/tracker"
                icon="/media/icons/duotune/graphs/gra007.svg"
                title="Payments & Allotments"
                fontIcon="bi-clipboard-data"
              />
            </Can>
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

          <Can perm="report.read">
            <AsideMenuItem
              to="/reports-hub"
              icon="/media/icons/duotune/graphs/gra010.svg"
              title="Reports Hub"
              fontIcon="bi-grid-3x3-gap"
            />
          </Can>
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
            <Can perm="role.assign">
            
              <AsideMenuItem
                to="/user-management/roles/manage"
                title="Roles & Permissions"
                hasBullet={true}
              />
            </Can>
            <Can perm="user.write">
              <AsideMenuItem
                to="/user-management/users/manage"
                title="User Management"
                hasBullet={true}
              />
            </Can>
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
          <Can perm="permission.grant">
            <AsideMenuItem
              to="/activity-log"
              icon="/media/icons/duotune/general/gen019.svg"
              title="Activity Log"
              fontIcon="bi-journal-text"
            />
          </Can>
        </>
      )}
      {showLeads && (
        <Can perm="user.read">
          <AsideMenuItem
            to="/leads"
            icon="/media/icons/duotune/communication/com005.svg"
            title="Leads"
            fontIcon="bi-people"
          />
        </Can>
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
          {/* TODO(product): confirm permission for /old-data-mapping (Firebase Data Mapping) — defaulted to assessment.create. */}
          <Can perm="assessment.create">
            <AsideMenuItem
              to="/old-data-mapping"
              icon="/media/icons/duotune/general/gen022.svg"
              title="Firebase Data Mapping"
              fontIcon="bi-arrow-left-right"
            />
          </Can>
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
          {/* TODO(product): confirm permission for /score-debug — defaulted to assessment.create. */}
          <Can perm="assessment.create">
            <AsideMenuItem
              to="/score-debug"
              icon="/media/icons/duotune/general/gen031.svg"
              title="Score Debug"
              fontIcon="bi-bug"
            />
          </Can>
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
            <Can perm="user.write">
              <AsideMenuItem to="/admin/counsellors" title="Manage Counsellors" hasBullet={true} />
            </Can>
            <Can perm="user.write">
              <AsideMenuItem to="/admin/counselling-students" title="Manage Students" hasBullet={true} />
            </Can>
            <Can perm="user.write">
              <AsideMenuItem to="/admin/counselling-slots" title="Create Slots" hasBullet={true} />
            </Can>
            <Can perm="user.write">
              <AsideMenuItem to="/admin/counselling-notifications" title="Notifications" hasBullet={true} />
            </Can>
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
            to="/student"
            title="Student Portal"
            fontIcon="bi-app-indicator"
            icon="/media/icons/duotune/general/gen049.svg"
          >
            <AsideMenuItem to="/student/dashboard" title="Dashboard" hasBullet={true} />
            <AsideMenuItem to="/student/student-info" title="My Info" hasBullet={true} />
            <AsideMenuItem to="/student/navigator-360" title="Navigator 360" hasBullet={true} />
            <AsideMenuItem to="/student/assessments" title="My Assessments" hasBullet={true} />
            <AsideMenuItem to="/student/reports" title="My Reports" hasBullet={true} />
            <AsideMenuItem to="/student/counselling" title="Counselling" hasBullet={true} />
          </AsideMenuItemWithSub>
        </>
      )}
    </>
  );
}
