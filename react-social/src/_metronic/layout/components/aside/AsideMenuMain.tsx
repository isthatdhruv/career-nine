/* eslint-disable react/jsx-no-target-blank */
import { useIntl } from "react-intl";
import { AsideMenuItem } from "./AsideMenuItem";
import { AsideMenuItemWithSub } from "./AsideMenuItemWithSub";

export function AsideMenuMain() {
  const intl = useIntl();

  return (
    <>
      <AsideMenuItem
        to="/dashboard"
        icon="/media/icons/duotune/art/art002.svg"
        title={intl.formatMessage({ id: "MENU.DASHBOARD" })}
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/assessments"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Assessments"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/college"
        icon="/media/icons/duotune/general/gen001.svg"
        title="College"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/assessment-questions"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Assessment Questions"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/question-sections"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Assessment Sections"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/tools"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Tools"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/measured-qualities"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Measured Qualities"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/measured-quality-types"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Measured Quality Types"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/career"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Career"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/upload-excel"
        icon="/media/icons/duotune/general/gen044.svg"
        title="Upload Excel File"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/board"
        icon="/media/icons/duotune/finance/fin001.svg"
        title="Board"
        fontIcon="bi-app-indicator"
      />

      <AsideMenuItem
        to="/section"
        icon="/media/icons/duotune/finance/fin001.svg"
        title="Section"
        fontIcon="bi-app-indicator"
      />

      <div className="menu-item">
        <div className="menu-content pt-8 pb-2">
          <span className="menu-section text-muted text-uppercase fs-8 ls-1">
            Counsellor
          </span>
        </div>
      </div>

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
       <AsideMenuItem
          to="/assessment-sections"
          title="Assessment Section List"
          hasBullet={true}
        />
        <AsideMenuItem
          to="/assessment-questions"
          title="Assessment Questions"
          hasBullet={true}
        /> 
      </AsideMenuItemWithSub>

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
{/* 
      <AsideMenuItem
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

      {/* <AsideMenuItemWithSub
        to=""
        title="Students Registration"
        fontIcon="bi-app-indicator"
        icon="/media/icons/duotune/communication/com006.svg"
      >
        <AsideMenuItem
          to="/student/registration-details"
          title="Registrations List"
          hasBullet={true}
        />
        <AsideMenuItem
          to="/student/registration-form"
          title="Registration Form"
          hasBullet={true}
        />
        <AsideMenuItem
          to="/student/registrar/page"
          title="Registrations Course Branch Batch page"
          hasBullet={true}
        />
      </AsideMenuItemWithSub> */}

      {/* <AsideMenuItem
        to="/studentlist"
        title="Student's List & Profile"
        fontIcon="bi-app-indicator"
        icon="/media/icons/duotune/communication/com006.svg"
      ></AsideMenuItem> */}
      {/* <AsideMenuItem
        to="/compiler"
        icon="/media/icons/duotune/coding/cod003.svg"
        title="Compiler"
        fontIcon="bi-app-indicator"
      /> */}
      <div className="menu-item">
        <div className="menu-content pt-8 pb-2">
          <span className="menu-section text-muted text-uppercase fs-8 ls-1">
            TEACHER
          </span>
        </div>
      </div>
      <AsideMenuItemWithSub
        to=""
        title="Teachers Registration"
        fontIcon="bi-app-indicator"
        icon="/media/icons/duotune/communication/com006.svg"
      >
       <AsideMenuItem
          to="/faculty/registration-details"
          title="Registrations List"
          hasBullet={true}
        />
        <AsideMenuItem
          to="/faculty/registration-form"
          title="Registration Form"
          hasBullet={true}
        /> 
      </AsideMenuItemWithSub>


      <div className="menu-item">
        <div className="menu-content pt-8 pb-2">
          <span className="menu-section text-muted text-uppercase fs-8 ls-1">
            ROLES
          </span>
        </div>
      </div>
      <AsideMenuItemWithSub
        to="/apps/chat"
        title="Roles"
        fontIcon="bi-chat-left"
        icon="/media/icons/duotune/general/gen019.svg"
      >
        <AsideMenuItem to="roles/role" title="Role" hasBullet={true} />
        <AsideMenuItem
          to="roles/role_roleGroup"
          title="Role - Role Group"
          hasBullet={true}
        />
        <AsideMenuItem
          to="roles/roleUser"
          title="Role - User"
          hasBullet={true}
        />
      </AsideMenuItemWithSub>
    </>
  );
}
