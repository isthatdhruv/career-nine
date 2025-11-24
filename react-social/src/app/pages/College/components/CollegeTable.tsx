// CollegeTable.tsx
import React, { useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit, AiOutlineInfoCircle } from "react-icons/ai";
import { Link } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { Button } from "react-bootstrap-v5";

import { DeleteCollegeData } from "../API/College_APIs";
import CollegeEditModal from "./CollegeEditModal";
import CollegeInfoModal from "./CollegeInfoModal";

// Layout reference image (local path)
const layoutImagePath = "/mnt/data/556d6c4d-1033-4fd7-8d4f-f02d4f436ce2.png";

/**
 * Row item shape coming from parent table data
 * (kept permissive — API may return extra fields)
 */
type CollegeRow = {
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
}) => {
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState<CollegeRow>({
    instituteName: "",
    instituteAddress: "",
    instituteCode: "",
  });

  // Info modal state: typed as ModalData | undefined
  const [infoModalShow, setInfoModalShow] = useState(false);
  const [infoModalData, setInfoModalData] = useState<ModalData | undefined>(undefined);

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
        row.contactPersons && Array.isArray(row.contactPersons) && row.contactPersons.length
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
        if (typeof d.display === "string") return d.display !== "0" && d.display !== "false";
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
              onClick={async () => {
                try {
                  props.setLoading(true);
                  // Pass instituteCode (may be undefined) - adjust API if it requires a string
                  await DeleteCollegeData(data.instituteCode);
                  // trigger parent reload — toggle pattern is generic
                  props.setPageLoading((p: any) => !p);
                } catch (err) {
                  console.error("Delete failed:", err);
                } finally {
                  props.setLoading(false);
                }
              }}
              className="btn btn-icon btn-danger btn-sm me-3"
            >
              <UseAnimations animation={trash} size={22} strokeColor={"#EFF8FE"} />
            </button>

            {/* Add Course Button */}
            <Link
              to="/course"
              state={{
                collegeId: data.instituteCode,
                college: data.instituteName,
              }}
              className="btn btn-sm btn-info me-3"
            >
              Add Course
            </Link>

            {/* Info Button - opens modal instead of navigation */}
            <Button
              variant="primary"
              onClick={() => {
                setInfoModalData(toModalData(data));
                setInfoModalShow(true);
              }}
            >
              <AiOutlineInfoCircle size={18} />
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
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={datatable}
      />

      {/* Edit modal (existing) */}
      <CollegeEditModal
        show={modalShowEdit}
        onHide={() => setModalShowEdit(false)}
        data={editModalData}
        setPageLoading={props.setPageLoading}
      />

      {/* Info modal (new) */}
      <CollegeInfoModal
        show={infoModalShow}
        onHide={() => setInfoModalShow(false)}
        data={infoModalData}
        setPageLoading={props.setPageLoading}
      />
    </>
  );
};

export default CollegeTable;
