// ContactPersonTable.tsx
import React, { useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteContactInformationData } from "../API/Contact_Person_APIs";
import ContactPersonEditModal from "./ContactPersonEditModal";

type ContactRow = {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  gender?: string;
  designation?: string;
};

const ContactPersonTable = (props: {
  data?: ContactRow[];
  setLoading: (v: boolean) => void;
  setPageLoading: (v: any) => void;
}) => {
  const navigate = useNavigate();
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [editModalData, setEditModalData] = useState<ContactRow>({
    id: undefined,
    name: "",
    email: "",
    phone: "",
    gender: "",
    designation: "",
  });

  // Defensive: if no data, use empty array
  const rowsSource = Array.isArray(props.data) ? props.data : [];

  const datatable = {
    columns: [
      {
        label: "Contact Person Name",
        field: "name",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Contact Person Name",
        },
      },
      {
        label: "Contact Person Email",
        field: "email",
        sort: "asc",
        width: 150,
      },
      {
        label: "Contact Person Phone Number",
        field: "phone",
        sort: "asc",
        width: 150,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],

    rows: rowsSource.map((row) => {
      // prefer phone, fallback to phoneNumber
      const phone = row.phone ?? (row as any).phoneNumber ?? "";

      return {
        // include an id/key field if your table or actions need it
        id: row.id,
        name: row.name ?? "",
        email: row.email ?? "",
        phone,
        actions: (
          <>
            <button
              onClick={() => {
                setEditModalData(row);
                setModalShowEdit(true);
              }}
              className="btn btn-icon btn-primary btn-sm me-3"
              type="button"
            >
              <AiFillEdit size={16} />
            </button>

            <button
              onClick={async () => {
                props.setLoading(true);
                try {
                  if (!row.id) throw new Error("Missing id for delete");
                  await DeleteContactInformationData(row.id);
                  props.setPageLoading(["true"]);
                } catch (error) {
                  console.error("Delete failed:", error);
                  alert("Failed to delete contact person. Please try again.");
                } finally {
                  props.setLoading(false);
                }
              }}
              className="btn btn-icon btn-danger btn-sm me-3"
              type="button"
            >
              <UseAnimations animation={trash} size={22} strokeColor={"#EFF8FE"} />
            </button>
          </>
        ),
      };
    }),
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

      {/* Example: you should render your edit modal somewhere and pass editModalData */}
      <ContactPersonEditModal
          show={modalShowEdit}
          onHide={() => setModalShowEdit(false)}
          data={editModalData}
          setPageLoading={props.setPageLoading}
        />
    </>
  );
};

export default ContactPersonTable;
