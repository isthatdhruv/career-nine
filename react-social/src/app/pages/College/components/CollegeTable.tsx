// CollegeTable.tsx
import { useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit, AiOutlineInfoCircle } from "react-icons/ai";
import { Link, useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { Button, Dropdown } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdEdit, MdDelete, MdSchool, MdOutlineDashboard } from "react-icons/md";

import { DeleteCollegeData } from "../API/College_APIs";
import CollegeEditModal from "./CollegeEditModal";
import CollegeInfoModal from "./CollegeInfoModal";
import CollegeAssignRoleModal from "../components/CollegeAssignRoleModal";
import CollegeDetailModal from "./CollegeSectionSessionGradeModal";
import AssessmentMappingModal from "./AssessmentMappingModal";

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
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState<CollegeRow>({
    instituteName: "",
    instituteAddress: "",
    instituteCode: "",
  });

  // Info modal state: typed as ModalData | undefined
  const [infoModalShow, setInfoModalShow] = useState(false);
  const [infoModalData, setInfoModalData] = useState<ModalData | undefined>(
    undefined
  );

  const [detailModalShow, setDetailModalShow] = useState(false);
  const [detailModalData, setDetailModalData] = useState<ModalData | undefined>(
    undefined
  );

  const [infoRolesModalShow, setInfoRolesModalShow] = useState(false);
  const [infoRolesModalData, setInfoRolesModalData] = useState<ModalData | undefined>(
    undefined
  );

  const [assessmentMappingModalShow, setAssessmentMappingModalShow] = useState(false);
  const [assessmentMappingInstitute, setAssessmentMappingInstitute] = useState<{
    code: number;
    name: string;
  }>({ code: 0, name: "" });

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
        name: data.instituteName ?? "",
        code: data.instituteCode ?? "",
        address: data.instituteAddress ?? "",
        actions: (
          <>
            {/* Edit Button */}
            <button
              type="button"
              onClick={() => {
                setEditModalData(data);
                setModalShowEdit(true);
              }}
              className="btn btn-icon btn-primary btn-sm me-3"
            >
              <AiFillEdit size={16} />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const deleteId = data.id ?? data.instituteCode;

                  console.log("Attempting to delete college. Row:", data);
                  console.log("Using deleteId:", deleteId);

                  if (!deleteId) {
                    console.error(
                      "No 'id' or 'instituteCode' found on this row. Cannot call DeleteCollegeData."
                    );
                    alert("Cannot delete: no valid ID found for this record.");
                    return;
                  }

                  props.setLoading(true);

                  // 🔹 Backend expects /instituteDetail/delete/{id}
                  await DeleteCollegeData(deleteId);

                  // trigger parent reload — toggle pattern is generic
                  props.setPageLoading((p: any) => !p);
                } catch (err) {
                  console.error("Delete failed:", err);
                  alert("Delete failed. Check console for details.");
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
                {/* Add Course */}
                <Link
                  to="/course"
                  state={{
                    collegeId: data.instituteCode,
                    college: data.instituteName,
                  }}
                  style={{ textDecoration: 'none' }}
                >
                  <Dropdown.Item as="button">
                    <AiOutlineInfoCircle size={18} className="me-2" />
                    Add Course
                  </Dropdown.Item>
                </Link>

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

                {/* Add Details */}
                <Dropdown.Item
                  onClick={() => {
                    setDetailModalData(toModalData(data));
                    setDetailModalShow(true);
                  }}
                >
                  <AiOutlineInfoCircle size={18} className="me-2" />
                  Add Details
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

                {/* Assessment Mapping */}
                <Dropdown.Item
                  onClick={() => {
                    setAssessmentMappingInstitute({
                      code: Number(data.instituteCode),
                      name: data.instituteName || "",
                    });
                    setAssessmentMappingModalShow(true);
                  }}
                >
                  <MdSchool size={18} className="me-2" />
                  Assessment Mapping
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            {/* Upload students excel for this institute */}
            {/* <Button
              variant="outline-success"
              size="sm"
              onClick={() => {
                if (props.onUploadClick) {
                  props.onUploadClick(editModalData);
                }
              }}
              onClickCapture={() => {
                if (typeof ({} as any) === "undefined") {}
              }}
            >
            </Button> */}
            {/* School Dashboard */}
            <Button
              variant="outline-info"
              size="sm"
              className="me-2"
              onClick={() => navigate(`/school/dashboard/${data.instituteCode || data.id}`)}
            >
              <IconContext.Provider value={{ style: { paddingBottom: "3px" } }}>
                <MdOutlineDashboard />
              </IconContext.Provider>
              <span style={{ marginLeft: 6 }}>Dashboard</span>
            </Button>

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

      {/* Edit modal (existing) */}
      <CollegeEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />

      {/* Info modal */}
      <CollegeInfoModal
        show={infoModalShow}
        onHide={() => setInfoModalShow(false)}
        data={infoModalData}
        setPageLoading={props.setPageLoading}
      />
      {/* Detail modal */}
      <CollegeDetailModal
        show={detailModalShow}
        onHide={() => setDetailModalShow(false)}
        data={detailModalData}
        setPageLoading={props.setPageLoading}
      />

      {/* Assign Roles */}
      <CollegeAssignRoleModal
        show={infoRolesModalShow}
        onHide={() => setInfoRolesModalShow(false)}
        data={infoRolesModalData}
        setPageLoading={props.setPageLoading}
      />

      {/* Assessment Mapping */}
      <AssessmentMappingModal
        show={assessmentMappingModalShow}
        onHide={() => setAssessmentMappingModalShow(false)}
        instituteCode={assessmentMappingInstitute.code}
        instituteName={assessmentMappingInstitute.name}
      />
    </>
  );
};

export default CollegeTable;