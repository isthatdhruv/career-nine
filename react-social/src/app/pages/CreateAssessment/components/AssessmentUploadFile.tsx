import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { MDBDataTableV5 } from "mdbreact";
import * as XLSX from "xlsx"; 
import { useNavigate } from "react-router-dom";

export default function AssessmentUploadFile() {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [tableData, setTableData] = useState<{
    columns: { label: string; field: string; sort: string; width: number }[];
    rows: any[];
  }>({
    columns: [],
    rows: [],
  });

  // Handle Excel file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".xlsx", ".xls"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      alert("❌ Only Excel files (.xlsx, .xls) are allowed!");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });

      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];

      // Convert worksheet to JSON if needed
      // const jsonData = XLSX.utils.sheet_to_json(worksheet);
      // setTableData({ columns: ..., rows: jsonData });
    };
    reader.readAsArrayBuffer(file);
    setFileName(file.name);
    setShowModal(false);
  };

  // Navigate to the next step
  const handleNext = () => {
    if (!fileName) {
      alert("❌ Please upload an Excel file before proceeding.");
      // return;
    }
    const payload = { fileName, tableData };
    localStorage.setItem("assessmentUploadStep", JSON.stringify(payload));
    navigate("/assessments/create/step-4");
  };

  // Cancel → act as Back button
  const handleCancel = () => {
    navigate(-1); // go to previous page
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="card-toolbar mb-4 d-flex justify-content-end">
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <IconContext.Provider value={{ style: { verticalAlign: "middle" } }}>
            <span className="d-flex align-items-center gap-2">
              <MdQuestionAnswer size={18} />
              Upload Excel File
            </span>
          </IconContext.Provider>
        </Button>
      </div>

      {/* File upload feedback */}
      {fileName && (
        <p className="mb-4 text-green-600 font-medium">
          ✅ Uploaded File: <span className="font-semibold">{fileName}</span>
        </p>
      )}

      {/* Upload Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload Excel File</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="form-control"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Data Table */}
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={tableData}
      />

      {/* Footer Buttons */}
      <div className="d-flex justify-content-end gap-2 mt-4">
        <Button variant="light" onClick={handleCancel}>
          Back
        </Button>
        <Button variant="primary" onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
