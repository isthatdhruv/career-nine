import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { MDBDataTableV5 } from "mdbreact";
import * as XLSX from "xlsx";
import { setData } from "./StudentDataComputationExcel";
import { SchoolOMRRow } from "./DataStructure";

/* ================= MASTER SCHEMA ================= */

const SCHEMA_FIELDS = [
  "collegeEnrollmentNumber",
  "_0thMarks",
  "_0thRollNo",
  "_0thboard",
  "_2thMarksChemistry",
  "_2thMarksMaths",
  "_2thMarksPhysics",
  "_2thRollNoss",
  "_2thboardSS",
  "aadharCard",
  "aadharCardNo",
  "aadharCardPhysical",
  "adhaarCardParents",
  "adhaarCardParentsPhysical",
  "affidavitForGap",
  "affidavitForGapPhysical",
  "allotmentLetter",
  "allotmentLetterPhysical",
  "antiRaggingAffidavit",
  "antiRaggingAffidavitPhysical",
  "batch_id",
  "birthdayMail",
  "branch_id",
  "casteCertificate",
  "casteCertificatePhysical",
  "category",
  "characterCertificate",
  "characterCertificatePhysical",
  "course",
  "cryptoWalletAddress",
  "currentAddress",
  "display",
  "dob",
  "domicileCertificateUp",
  "domicileCertificateUpPhysical",
  "fatherName",
  "fatherPhoneNumber",
  "fatherPhotograph",
  "fatherPhotographPhysical",
  "firstName",
  "gender",
  "generate",
  "highSchoolCertificate",
  "highSchoolCertificatePhysical",
  "highSchoolMarksheet",
  "highSchoolMarksheetPhysical",
  "hindiName",
  "image",
  "incomeCertificate",
  "incomeCertificatePhysical",
  "intermediateCertificate",
  "intermediateCertificatePhysical",
  "intermediateMarksheet",
  "intermediateMarksheetPhysical",
  "ipfsPdfUrl",
  "ipfsUrl",
  "lastName",
  "medicalCertificate",
  "medicalCertificatePhysical",
  "middleName",
  "migrationCertificate",
  "migrationCertificatePhysical",
  "motherName",
  "motherPhotograph",
  "motherPhotographPhysical",
  "nftHashCode",
  "officialEmailAddress",
  "panCardParents",
  "panCardParentsPhysical",
  "pdf",
  "permanentAddress",
  "personalEmailAddress",
  "phoneNumber",
  "qualifiedRankLetter",
  "qualifiedRankLetterPhysical",
  "rollNo",
  "studentPhotograph",
  "studentPhotographPhysical",
  "studentSignature",
  "studentSignaturePhysical",
  "studentThumbImpression",
  "studentThumbImpressionPhysical",
  "studentscol",
  "transferCertificate",
  "transferCertificatePhysical",
  "typeOfStudent",
  "webcamPhoto",
  "ews",
  "subCategory",
  "counselling",
  "homeBoard12th",
  "googleGroup",
  "other10thBoard",
  "other12thBoard",
  "check",
  "instituteBatch",
  "instituteBranch",
  "instituteGoogleGroup",
  "genderData",
  "categoryData",
  "courseData",
  "branchData",
  "batchData",
  "google",
];

/* ================= DEFAULT OBJECT ================= */

const DEFAULT_SCHEMA_OBJECT: Record<string, any> = {
  collegeEnrollmentNumber: 0,
  _0thMarks: "0",
  _0thRollNo: "0",
  _0thboard: 0,
  _2thMarksChemistry: "0",
  _2thMarksMaths: "0",
  _2thMarksPhysics: "0",
  _2thRollNoss: "0",
  _2thboardSS: 0,
  aadharCard: "0",
  aadharCardNo: "0",
  aadharCardPhysical: 0,
  adhaarCardParents: "0",
  adhaarCardParentsPhysical: 0,
  affidavitForGap: "0",
  affidavitForGapPhysical: 0,
  allotmentLetter: "0",
  allotmentLetterPhysical: 0,
  antiRaggingAffidavit: "0",
  antiRaggingAffidavitPhysical: 0,
  batch_id: 0,
  birthdayMail: "0",
  branch_id: 0,
  casteCertificate: "0",
  casteCertificatePhysical: 0,
  category: 1,
  characterCertificate: "0",
  characterCertificatePhysical: 0,
  course: 0,
  cryptoWalletAddress: "0",
  currentAddress: "0",
  display: 1,
  dob: "0",
  domicileCertificateUp: "0",
  domicileCertificateUpPhysical: 0,
  fatherName: "0",
  fatherPhoneNumber: "0",
  fatherPhotograph: "0",
  fatherPhotographPhysical: 0,
  firstName: "0",
  gender: 0,
  generate: "0",
  highSchoolCertificate: "0",
  highSchoolCertificatePhysical: 0,
  highSchoolMarksheet: "0",
  highSchoolMarksheetPhysical: 0,
  hindiName: "0",
  image: "MA==",
  incomeCertificate: "0",
  incomeCertificatePhysical: 0,
  intermediateCertificate: "0",
  intermediateCertificatePhysical: 0,
  intermediateMarksheet: "0",
  intermediateMarksheetPhysical: 0,
  ipfsPdfUrl: "0",
  ipfsUrl: "0",
  lastName: "0",
  medicalCertificate: "0",
  medicalCertificatePhysical: 0,
  middleName: "0",
  migrationCertificate: "0",
  migrationCertificatePhysical: 0,
  motherName: "0",
  motherPhotograph: "0",
  motherPhotographPhysical: 0,
  nftHashCode: "0",
  officialEmailAddress: "0",
  panCardParents: "0",
  panCardParentsPhysical: 0,
  pdf: "MA==",
  permanentAddress: "0",
  personalEmailAddress: "0",
  phoneNumber: "0",
  qualifiedRankLetter: "0",
  qualifiedRankLetterPhysical: 0,
  rollNo: 0,
  studentPhotograph: "0",
  studentPhotographPhysical: 0,
  studentSignature: "0",
  studentSignaturePhysical: 0,
  studentThumbImpression: "0",
  studentThumbImpressionPhysical: 0,
  studentscol: "0",
  transferCertificate: "0",
  transferCertificatePhysical: 0,
  typeOfStudent: "0",
  webcamPhoto: "0",
  ews: false,
  subCategory: "0",
  counselling: false,
  homeBoard12th: false,
  googleGroup: "0",
  other10thBoard: null,
  other12thBoard: null,
  check: null,
  instituteBatch: null,
  instituteBranch: null,
  instituteGoogleGroup: null,
  genderData: null,
  categoryData: null,
  courseData: null,
  branchData: null,
  batchData: null,
  google: false,
};

/* ================= COMPONENT ================= */

export default function ToolsPage() {
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState("");
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(true);

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
      setColumnMap(initialMap);

      setShowMapping(true);
      setTableData({ columns: [], rows: [] });
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

  const handleSubmit = () => {
    const finalPayload = rawExcelData.map((row) => {
      const obj = { ...DEFAULT_SCHEMA_OBJECT };

      Object.entries(columnMap).forEach(([excelCol, schemaField]) => {
        if (schemaField) {
          obj[schemaField] =
            row[excelCol] ?? DEFAULT_SCHEMA_OBJECT[schemaField];
        }
      });

      return obj;
    });

    console.log("✅ FINAL SUBMITTED JSON");
    console.log(JSON.stringify(finalPayload, null, 2));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Button onClick={() => setShowModal(true)}>Upload Excel</Button>
      {fileName && <p className="mt-2">✅ {fileName}</p>}

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Body>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
        </Modal.Body>
      </Modal>

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
                <option value="">-- Select Schema Field --</option>
                {SCHEMA_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <Button className="mt-3" onClick={applyMapping}>
            Apply Mapping
          </Button>
        </div>
      )}

      {tableData.rows.length > 0 && (
        <>
          <MDBDataTableV5
            hover
            bordered
            striped
            entries={25}
            data={tableData}
            scrollY
            maxHeight="65vh"
          />

          <div className="mt-4 flex justify-end">
            <Button variant="success" onClick={handleSubmit}>
              Submit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
