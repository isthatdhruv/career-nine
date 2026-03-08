/* eslint-disable react/jsx-no-target-blank */
import { useIntl } from "react-intl";
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
  const { currentUser } = useAuth();
  const authorityUrls: string[] = currentUser?.authorityUrls ?? [];
  const allowed = (path: string) => {
    const normalized = path.startsWith("/") ? path : "/" + path;
    return isUrlAllowed(normalized, authorityUrls);
  };

  // Section visibility: show section header + submenu only if at least one child is allowed
  const showInstitute =
    allowed("/college") || allowed("/contact-person") || allowed("/group-student") ||
    allowed("/board") || allowed("/upload-excel") || allowed("/studentlist");

  const showQuestionnaire =
    allowed("/questionare/create") || allowed("/questionaire/List") ||
    allowed("/tools") || allowed("/game-list");

  const showQualities =
    allowed("/measured-qualities") || allowed("/measured-quality-types");

  const showRegistration = allowed("/user-registrations");

  const showAssessment =
    allowed("/assessments") || allowed("/assessment-sections") ||
    allowed("/assessment-questions") || allowed("/question-sections") ||
    allowed("/text-response-mapping");

  const showReports = allowed("/reports");

  const showTeacherDashboards =
    allowed("/teacher/class-dashboard") || allowed("/principal/dashboard");

  const showTeacherRegistration =
    allowed("/faculty/registration-details") || allowed("/faculty/registration-form");

  const showTeacher = showTeacherDashboards || showTeacherRegistration;

  const showRoles =
    allowed("/roles/role") || allowed("/roles/users") ||
    allowed("/roles/role_roleGroup") || allowed("/roles/roleUser");

  const showActivityLog = allowed("/activity-log");
  const showLeads = allowed("/leads");

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
                title="Group Student Information"
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

      {showQuestionnaire && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                QUESTIONNAIRE
              </span>
            </div>
          </div>

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
        </>
      )}

      {showQualities && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                QUALITIES
              </span>
            </div>
          </div>

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
        </>
      )}

      {/* <AsideMenuItem
        to="/list"
        icon="/media/icons/duotune/general/gen044.svg"
        title="List"
        fontIcon="bi-app-indicator"
      /> */}

      {/* <AsideMenuItem
        to="/section"
        icon="/media/icons/duotune/finance/fin001.svg"
        title="Section"
        fontIcon="bi-app-indicator"
      /> */}

      {showRegistration && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Registration
              </span>
            </div>
          </div>
          <AsideMenuItemWithSub
            to=""
            title="User Registration"
            fontIcon="bi-app-indicator"
            icon="/media/icons/duotune/communication/com006.svg"
          >
            {allowed("/user-registrations") && (
              <AsideMenuItem
                to="/user-registrations"
                icon="/media/icons/duotune/general/gen044.svg"
                title="User Registration"
                fontIcon="bi-app-indicator"
              />
            )}
          </AsideMenuItemWithSub>
        </>
      )}

      {showAssessment && (
        <>
          <div className="menu-item">
            <div className="menu-content pt-8 pb-2">
              <span className="menu-section text-muted text-uppercase fs-8 ls-1">
                Assessment Section
              </span>
            </div>
          </div>

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
            {/* {allowed("/assessment-sections") && (
              <AsideMenuItem
                to="/assessment-sections"
                title="Assessment Section List"
                icon="/media/icons/duotune/general/gen044.svg"
                fontIcon="bi-app-indicator"
              />
            )} */}
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
            {allowed("/offline-assessment-upload") && (
              <AsideMenuItem
                to="/offline-assessment-upload"
                icon="/media/icons/duotune/general/gen044.svg"
                title="Offline Upload"
                fontIcon="bi-cloud-upload"
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

          <AsideMenuItem
            to="/reports"
            icon="/media/icons/duotune/files/fil003.svg"
            title="Reports & Exports"
            fontIcon="bi-file-earmark-bar-graph"
          />
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
            to="/apps/chat"
            title="Roles and Users"
            fontIcon="bi-chat-left"
            icon="/media/icons/duotune/general/gen019.svg"
          >
            {allowed("/roles/role") && (
              <AsideMenuItem to="/roles/role" title="Role" hasBullet={true} />
            )}
            {allowed("/roles/users") && (
              <AsideMenuItem
                to="/roles/users"
                title="Users"
                hasBullet={true}
              />
            )}
            {allowed("/roles/role_roleGroup") && (
              <AsideMenuItem
                to="/roles/role_roleGroup"
                title="Role - Role Group"
                hasBullet={true}
              />
            )}
            {allowed("/roles/roleUser") && (
              <AsideMenuItem
                to="/roles/roleUser"
                title="Role - User"
                hasBullet={true}
              />
            )}
          </AsideMenuItemWithSub>
        </>
      )}

      {allowed("/career") && (
        <AsideMenuItem
          to="/career"
          icon="/media/icons/duotune/general/gen044.svg"
          title="Career"
          fontIcon="bi-app-indicator"
        />
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
    </>
  );
}
