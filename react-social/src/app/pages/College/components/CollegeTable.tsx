// CollegeTable.tsx
import { useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { Dropdown } from "react-bootstrap";
import { MdOutlineDashboard } from "react-icons/md";
import { ActionIcon } from "../../../components/ActionIcon";
import { toAbsoluteUrl } from "../../../../_metronic/helpers";

import { DeleteCollegeData } from "../API/College_APIs";
import InstituteWizardModal from "./InstituteWizardModal";
import CollegeInfoModal from "./CollegeInfoModal";
import CollegeAssignRoleModal from "../components/CollegeAssignRoleModal";
import { showErrorToast } from '../../../utils/toast';
// import InstituteStudentsModal from "./InstituteStudentsModal"; // disabled: see "Students at this institute" below

// Layout reference image (local path)
const layoutImagePath = "/mnt/data/556d6c4d-1033-4fd7-8d4f-f02d4f436ce2.png";

/**
 * Row item shape coming from parent table data
 * (kept permissive — API may return extra fields)
 */
type CollegeRow = {
  id?: string | number; // 🔹 added: backend id used for delete
  instituteName?: string;
  instituteAddress?: string;
  instituteCode?: string;
  display?: boolean | string | number | undefined;
  // optional: questionOptions, contactPersons, etc. if present from API
  questionOptions?: string[];
  contactPersons?: any[];
  [k: string]: any;
};

/**
 * Modal-friendly partial form shape (matches CollegeInfoModal expected fields).
 * We only include fields the modal uses.
 */
type ModalData = {
  instituteName?: string;
  instituteAddress?: string;
  instituteCode?: string;
  display?: string | number | undefined;
  questionOptions?: string[];
  contactPersons?: any[];
};

const CollegeTable = (props: {
  data?: CollegeRow[];
  setLoading: (v: boolean) => void;
  setPageLoading: (v: any) => void;
  onUploadClick?: (college: CollegeRow) => void;
}) => {
  const [wizardShow, setWizardShow] = useState(false);
  const [wizardExisting, setWizardExisting] = useState<CollegeRow | null>(null);

  // Info modal state: typed as ModalData | undefined
  const [infoModalShow, setInfoModalShow] = useState(false);
  const [infoModalData, setInfoModalData] = useState<ModalData | undefined>(
    undefined
  );

  const [infoRolesModalShow, setInfoRolesModalShow] = useState(false);
  const [infoRolesModalData, setInfoRolesModalData] = useState<ModalData | undefined>(
    undefined
  );

  // Tracks which row currently shows the two Dashboard buttons (Institute / School).
  // Set by clicking the "Dashboard" item in that row's Actions dropdown.
  // null = no row expanded. Clicking Dashboard again on the same row collapses it.
  const [dashboardOpenFor, setDashboardOpenFor] = useState<string | null>(null);

  // Students-at-this-institute flow disabled per product request.
  // const [studentsModalShow, setStudentsModalShow] = useState(false);
  // const [studentsModalInstitute, setStudentsModalInstitute] = useState<{
  //   code: number;
  //   name: string;
  // }>({ code: 0, name: "" });

  const navigate = useNavigate();
  // convert a table row into the modal-compatible partial form shape
  const toModalData = (row: CollegeRow): ModalData => {
    // convert boolean display -> numeric (1/0), keep numeric/string as is
    let display: string | number | undefined;
    if (typeof row.display === "boolean") display = row.display ? 1 : 0;
    else display = row.display as string | number | undefined;

    return {
      instituteName: row.instituteName ?? "",
      instituteAddress: row.instituteAddress ?? "",
      instituteCode: row.instituteCode ?? "",
      display,
      // preserve if API returned these already, otherwise use minimal defaults
      questionOptions: row.questionOptions ?? [""],
      contactPersons:
        row.contactPersons &&
        Array.isArray(row.contactPersons) &&
        row.contactPersons.length
          ? row.contactPersons
          : [
              {
                name: "",
                email: "",
                phone: "",
                gender: "",
                designation: "",
              },
            ],
    };
  };

  // Prepare rows only for items with display === true (accepts boolean or numeric/string truthy)
  const rows =
    (props.data ?? [])
      .filter((d) => {
        if (!d) return false;
        // if display is boolean, require true; if string/number, treat "true"/1 as shown
        if (typeof d.display === "boolean") return d.display === true;
        if (typeof d.display === "number") return d.display !== 0;
        if (typeof d.display === "string")
          return d.display !== "0" && d.display !== "false";
        return Boolean(d.display);
      })
      .map((data) => ({
        name: (
          <div className="d-flex align-items-center gap-2">
            <img
              src={toAbsoluteUrl("/media/logos/kcc.webp")}
              alt={`${data.instituteName ?? "Institute"} logo`}
              style={{
                width: 36,
                height: 36,
                objectFit: "contain",
                borderRadius: 6,
              }}
              className="shadow-sm"
            />
            <span>{data.instituteName ?? ""}</span>
          </div>
        ),
        code: data.instituteCode ?? "",
        address: data.instituteAddress ?? "",
        actions: (
          <>
            {/* Edit Button — opens the institute wizard pre-filled */}
            <button
              type="button"
              onClick={() => {
                setWizardExisting(data);
                setWizardShow(true);
              }}
              className="btn btn-icon btn-primary btn-sm me-3"
            >
              <ActionIcon type="edit" size="sm" />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const deleteId = data.id ?? data.instituteCode;

                  if (!deleteId) {
                    console.error(
                      "No 'id' or 'instituteCode' found on this row. Cannot call DeleteCollegeData."
                    );
                    showErrorToast("Cannot delete: no valid ID found for this record.");
                    return;
                  }

                  props.setLoading(true);

                  // 🔹 Backend expects /instituteDetail/delete/{id}
                  await DeleteCollegeData(deleteId);

                  // trigger parent reload — toggle pattern is generic
                  props.setPageLoading((p: any) => !p);
                } catch (err) {
                  console.error("Delete failed:", err);
                  showErrorToast("Delete failed. Check console for details.");
                } finally {
                  props.setLoading(false);
                }
              }}
              className="btn btn-icon btn-danger btn-sm me-3"
            >
              <UseAnimations
                animation={trash}
                size={22}
                strokeColor={"#EFF8FE"}
              />
            </button>

            {/* Actions Dropdown - Combines Add Course, Info, and Assign Role */}
            <Dropdown className="d-inline">
              <Dropdown.Toggle 
                variant="success" 
                size="sm" 
                id={`dropdown-${data.instituteCode}`}
                className="dropdown-toggle"
              >
                Actions
              </Dropdown.Toggle>

              <Dropdown.Menu
                style={{
                  minWidth: '150px',
                  zIndex: 1050,
                }}
                popperConfig={{ strategy: 'fixed' }}
                renderOnMount
              >
                {/* Info */}
                <Dropdown.Item
                  onClick={() => {
                    setInfoModalData(toModalData(data));
                    setInfoModalShow(true);
                  }}
                >
                  <AiOutlineInfoCircle size={18} className="me-2" />
                  Info
                </Dropdown.Item>

                {/* Assign Role */}
                <Dropdown.Item
                  onClick={() => {
                    setInfoRolesModalData(toModalData(data));
                    setInfoRolesModalShow(true);
                  }}
                >
                  <AiOutlineInfoCircle size={18} className="me-2" />
                  Assign Roles
                </Dropdown.Item>

                {/* Dashboard — toggles the two dashboard buttons to the right of Actions */}
                <Dropdown.Item
                  onClick={() => {
                    const rowKey = String(data.instituteCode || data.id || "");
                    setDashboardOpenFor((current) =>
                      current === rowKey ? null : rowKey
                    );
                  }}
                >
                  <MdOutlineDashboard size={18} className="me-2" />
                  Dashboard
                </Dropdown.Item>

                {/* Students at this institute — disabled per product request
                <Dropdown.Item
                  onClick={() => {
                    setStudentsModalInstitute({
                      code: Number(data.instituteCode),
                      name: data.instituteName || "",
                    });
                    setStudentsModalShow(true);
                  }}
                >
                  <MdSchool size={18} className="me-2" />
                  Students at this institute
                </Dropdown.Item>
                */}
              </Dropdown.Menu>
            </Dropdown>

            {/* Two dashboard buttons — visible only after clicking "Dashboard" in
                the Actions dropdown for this row. */}
            {dashboardOpenFor === String(data.instituteCode || data.id || "") && (
              <>
                {/* Institute Dashboard -> InstituteDashboard.tsx */}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/school/principal/dashboard/${data.instituteCode || data.id}`
                    )
                  }
                  className="btn btn-sm btn-info ms-2 d-inline-flex align-items-center gap-1"
                  title="Dashboard 1"
                >
                  <MdOutlineDashboard size={16} />
                  Dashboard 1
                </button>

                {/* School Dashboard -> SchoolDashboardPage.tsx */}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/dashboard/school/${data.instituteCode || data.id}`
                    )
                  }
                  className="btn btn-sm btn-warning ms-2 d-inline-flex align-items-center gap-1"
                  title="Dashboard 2"
                >
                  <MdOutlineDashboard size={16} />
                  Dashboard 2
                </button>
              </>
            )}
          </>
        ),
      })) ?? [];

  const datatable = {
    columns: [
      {
        label: "Name",
        field: "name",
        width: 150,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Code",
        field: "code",
        sort: "asc",
        width: 100,
      },
      {
        label: "Address",
        field: "address",
        width: 100,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],
    rows: rows,
  };

  return (
    <>
      <style>{`
        .college-table-wrapper table tbody tr {
          position: relative;
        }
        .college-table-wrapper table tbody tr:has(.dropdown-menu.show) {
          z-index: 10;
        }
        .college-table-wrapper .dropdown-menu.show {
          position: fixed !important;
          z-index: 1050 !important;
        }
      `}</style>
      <div className="college-table-wrapper" style={{ overflow: 'visible' }}>
        <MDBDataTableV5
          hover
          entriesOptions={[5, 20, 25]}
          entries={25}
          pagesAmount={4}
          data={datatable}
        />
      </div>

      {/* Institute wizard — used for both edit and manage actions */}
      <InstituteWizardModal
        show={wizardShow}
        onHide={() => setWizardShow(false)}
        setPageLoading={props.setPageLoading}
        existing={wizardExisting}
      />

      {/* Info modal */}
      <CollegeInfoModal
        show={infoModalShow}
        onHide={() => setInfoModalShow(false)}
        data={infoModalData}
        setPageLoading={props.setPageLoading}
      />

      {/* Assign Roles */}
      <CollegeAssignRoleModal
        show={infoRolesModalShow}
        onHide={() => setInfoRolesModalShow(false)}
        data={infoRolesModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default CollegeTable;