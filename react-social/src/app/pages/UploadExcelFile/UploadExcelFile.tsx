import React, { useState } from "react";
import { Button, Modal, Alert, Spinner } from "react-bootstrap";
import { MDBDataTableV5 } from "mdbreact";
import * as XLSX from "xlsx";
import { setData } from "./StudentDataComputationExcel";
import { SchoolOMRRow } from "./DataStructure";
import { addStudentInfo, StudentInfo } from "../StudentInformation/StudentInfo_APIs";

/* ================= MASTER SCHEMA ================= */

const SCHEMA_FIELDS = [
  "name",
  "schoolRollNumber",
  "phoneNumber",
  "email",
  "address",
  "studentDob",
  "user"
];

/* ================= DEFAULT OBJECT ================= */

const DEFAULT_SCHEMA_OBJECT: Record<string, any> = {
  name: "",
  schoolRollNumber: "",
  phoneNumber: "",
  email: "",
  address: "",
  studentDob: "",
  user: null
};

/* ================= COMPONENT ================= */

export default function UploadExcelFile() {
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState("");
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; skipped: number } | null>(null);

  const [tableData, setTableData] = useState<{
    columns: any[];
    rows: SchoolOMRRow[];
  }>({ columns: [], rows: [] });

  /* ================= FILE UPLOAD ================= */

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!json.length) return;

      const headers = Object.keys(json[0]);
      setExcelColumns(headers);
      setRawExcelData(json);

      const initialMap: Record<string, string> = {};
      headers.forEach((h) => (initialMap[h] = ""));
      
      // Auto-map if possible (case-insensitive)
      headers.forEach(h => {
          const lowerH = h.toLowerCase();
          const match = SCHEMA_FIELDS.find(f => f.toLowerCase() === lowerH || 
            (f === 'schoolRollNumber' && lowerH.includes('roll')) || 
            (f === 'phoneNumber' && (lowerH.includes('phone') || lowerH.includes('mobile')))
          );
          if (match) initialMap[h] = match;
      });

      setColumnMap(initialMap);

      setShowMapping(true);
      setTableData({ columns: [], rows: [] });
      setUploadResult(null);
    };

    reader.readAsArrayBuffer(file);
    setFileName(file.name);
    setShowModal(false);
  };

  /* ================= APPLY MAPPING ================= */

  const applyMapping = () => {
    const processed = setData(rawExcelData, columnMap);

    const selectedFields = Array.from(
      new Set(Object.values(columnMap).filter((v) => v))
    );

    const columns = selectedFields.map((f) => ({
      label: f,
      field: f,
      sort: "asc",
      width: 150,
    }));

    setTableData({ columns, rows: processed });
    setShowMapping(false);
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async () => {
    // setUploading(true);
    let successCount = 0;
    let skippedCount = 0;

    const uploadPromises = rawExcelData.map(async (row) => {
      const obj = { ...DEFAULT_SCHEMA_OBJECT };
      let isValid = true;

      Object.entries(columnMap).forEach(([excelCol, schemaField]) => {
        if (schemaField) {
          const val = row[excelCol];
          obj[schemaField] = val ?? ""; // Send empty string if undefined/null
          
          // Validation: Check for "ERROR" in specific fields
          if (schemaField==="studentDob" && (val===""||val==="Null"||val==="null")) {
              isValid = false;
          }
        }
      });

      if (!isValid) {
          skippedCount++;
          return;
      }

      try {
          await addStudentInfo(obj as StudentInfo);
          successCount++;
      } catch (error) {
          console.error("Failed to upload info for row", row, error);
          skippedCount++; 
      }
    });

    await Promise.all(uploadPromises);
    setUploadResult({ success: successCount, skipped: skippedCount });
    setUploading(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Button onClick={() => setShowModal(true)}>Upload Excel</Button>
      {fileName && <span className="ms-2 mt-2">✅ {fileName}</span>}

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Body>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
        </Modal.Body>
      </Modal>
      
      {uploadResult && (
          <Alert variant="info" className="mt-3">
              Upload Complete. Success: <strong>{uploadResult.success}</strong>. Skipped (Errors/Invalid): <strong>{uploadResult.skipped}</strong>.
          </Alert>
      )}

      {excelColumns.length > 0 && showMapping && (
        <div className="bg-white p-4 mt-4 rounded shadow">
          <h5>Map Excel Columns</h5>

          {excelColumns.map((col) => (
            <div key={col} className="flex gap-3 mb-2 items-center">
              <div className="w-64">{col}</div>
              <select
                className="form-select"
                value={columnMap[col]}
                onChange={(e) =>
                  setColumnMap({ ...columnMap, [col]: e.target.value })
                }
              >
                <option value="">-- Ignore --</option>
                {SCHEMA_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <Button className="mt-3" onClick={applyMapping}>
            Show Preview
          </Button>
        </div>
      )}

      {tableData.rows.length > 0 && !showMapping && (
        <>
            <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={() => setShowMapping(true)} className="mb-2">Back to Mapping</Button>
                <MDBDataTableV5
                    hover
                    bordered
                    striped
                    entries={25}
                    data={tableData}
                    scrollY
                    maxHeight="65vh"
                />
            </div>

          <div className="mt-4 flex justify-end">
            <Button variant="success" onClick={handleSubmit} disabled={uploading}>
              {/* {uploading ? <Spinner animation="border" size="sm" /> : "Submit Valid Students"} */}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
