import React, { useEffect, useState } from "react";
import { Button, Modal, Dropdown } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { ReadToolData } from "../Tool/API/Tool_APIs";

export default function ToolsPage() {
  const [fileName, setFileName] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0]; // only one file allowed

    if (file) {
      const allowedExtensions = [".xlsx", ".xls"];
      const fileExtension = file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        alert("❌ Only Excel files (.xlsx, .xls) are allowed!");
        event.target.value = ""; // reset input
        return;
      }

      setFileName(file.name);
      setShowModal(false); // close modal after valid selection
    }
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadToolData();
        console.log("Fetched sections data:", response.data);
        // You can process response.data here as needed
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };
    fetchSections();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="card-toolbar">
        <div className="d-flex justify-content-end gap-2">
          {/* Show Select Tool dropdown ONLY after a file is uploaded */}
          {fileName && (
            <Dropdown>
              <Dropdown.Toggle
                as={Button}
                variant="success"
                id="dropdown-tools"
                className="d-flex align-items-center gap-2"
              >
                <MdQuestionAnswer size={20} />
                <span>Select Tool</span>
              </Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Item href="#/action-1">Tool 1</Dropdown.Item>
                <Dropdown.Item href="#/action-2">Tool 2</Dropdown.Item>
                <Dropdown.Item href="#/action-3">Tool 3</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}

          {/* Upload Excel Button */}
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <IconContext.Provider
              value={{ style: { verticalAlign: "middle" } }}
            >
              <span className="d-flex align-items-center gap-2">
                <MdQuestionAnswer size={18} />
                Upload Excel File
              </span>
            </IconContext.Provider>
          </Button>
        </div>
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
    </div>
  );
}
