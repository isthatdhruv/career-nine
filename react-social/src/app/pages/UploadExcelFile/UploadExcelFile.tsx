import React, { useEffect, useState } from "react";
import { Button, Modal, Dropdown } from "react-bootstrap";
import { IconContext } from "react-icons";
import { MdQuestionAnswer } from "react-icons/md";
import { ReadToolData } from "../Tool/API/Tool_APIs";
import { MDBDataTableV5 } from "mdbreact";
import * as XLSX from "xlsx"; // Add this import
import { setData } from "./StudentDataComputationExcel";
import { SchoolOMRRow } from "./DataStructure";

export default function ToolsPage() {
  const [fileName, setFileName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("Select Tool");
  const [tableData, setTableData] = useState<{
    columns: { label: string; field: string; sort: string; width: number }[];
    rows: any[];
  }>({
    columns: [],
    rows: [],
  });

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

      // Read the Excel file
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Get first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];

        // Convert to JSON
        const jsonData:any[] = XLSX.utils.sheet_to_json(worksheet);
        var data2:SchoolOMRRow[] = setData( jsonData); // Use the setData function to process data
        if (data2.length > 0) {
          // Create columns from the first row
          const columns = Object.keys(data2[0]).map((key) => ({
            label: key,
            field: key,
            sort: "asc",
            width: 150,
          }));

          // Set the table data
          setTableData({
            columns: columns,
            rows: jsonData,
          });
        }
      };
      reader.readAsArrayBuffer(file);
      setFileName(file.name);
      setShowModal(false); // close modal after valid selection
    }
  };

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await ReadToolData();
        setTools(response.data);
      } catch (error) {
        console.error("Error fetching tools:", error);
      }
    };
    fetchTools();
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
                {tools.length > 0 ? (
                  tools.map((tool) => (
                    <Dropdown.Item
                      key={tool.id} // 🔑 use correct field from API
                      onClick={
                        () => setSelectedTool(tool.name) // 🔑 adjust if API field is toolName/title
                      }
                    >
                      {tool.name}
                    </Dropdown.Item>
                  ))
                ) : (
                  <Dropdown.Item disabled>No tools available</Dropdown.Item>
                )}
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
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={tableData} // Add the table data here
      />
    </div>
  );
}
