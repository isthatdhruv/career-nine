import React, { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import * as XLSX from "xlsx";
import { StudentTable } from "./StudentTable";

type Props = {
  show: boolean;
  onHide: () => void;
  onUpload?: (rows: any[][]) => void;
};

const TEMPLATE_HEADERS = [
  "Name",
  "Roll Number",
  "Control Number",
  "Phone1",
  "Phone2",
  "Email",
  "Class",
  "Section",
];

const normalize = (s: any) => String(s ?? "").trim().toLowerCase();

const findColumnIndexMap = (hdrRow: any[]): Record<string, number> => {
  const map: Record<string, number> = {};
  hdrRow.forEach((h: any, idx: number) => {
    const n = normalize(h);
    if (!n) return;
    if (["name", "full name", "student name"].includes(n)) map["Name"] = idx;
    else if (["roll", "rollno", "roll number", "roll_number"].includes(n))
      map["Roll Number"] = idx;
    else if (["control number", "control_number", "controlnumber", "control no", "control"].includes(n))
      map["Control Number"] = idx;
    else if (["phone1", "phone_1", "mobile1", "mobile_1", "phone"].includes(n))
      map["Phone1"] = idx;
    else if (["phone2", "phone_2", "mobile2", "mobile_2"].includes(n))
      map["Phone2"] = idx;
    else if (["email", "email address", "e-mail"].includes(n)) map["Email"] = idx;
    else if (["class", "grade"].includes(n)) map["Class"] = idx;
    else if (["section", "group"].includes(n)) map["Section"] = idx;
  });
  return map;
};

const buildFilteredRows = (raw: any[][]): any[][] => {
  if (!raw || raw.length === 0) return [];
  const hdr = raw[0].map((c) => String(c ?? "").trim());
  const colMap = findColumnIndexMap(hdr);
  // If header doesn't contain the desired columns, attempt fallback by position
  const headerRow = TEMPLATE_HEADERS;
  const rows = [headerRow];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const out = TEMPLATE_HEADERS.map((col, i) => {
      if (col in colMap) return row[colMap[col]] ?? "";
      // fallback: try to pick by common positions: name(0), roll(1), phone1(2), phone2(3)...
      return row[i] ?? "";
    });
    // skip entirely empty rows
    if (out.every((c) => String(c ?? "").trim() === "")) continue;
    rows.push(out);
  }
  return rows;
};

const downloadTemplate = () => {
  const csv = [TEMPLATE_HEADERS, ["John Doe", "R001", "12345", "9876543210", "9123456780", "john@example.com", "10", "A"]]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const StudentUploadModal: React.FC<Props> = ({ show, onHide, onUpload }) => {
  const [rows, setRows] = useState<any[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data as ArrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const extracted = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (!extracted || extracted.length === 0) {
          setError("File cannot be processed: no data found.");
          setRows(null);
          return;
        }

        // Relaxed header check: require at least Name, Roll Number, Class and Section (case-insensitive)
        const rawHeader = (extracted[0] || []).map((c) => String(c ?? "").trim());
        const colMap = findColumnIndexMap(rawHeader);
        const minimalRequired = ["Name", "Roll Number", "Class", "Section"];
        const missingMinimal = minimalRequired.filter((h) => !(h in colMap));
        if (missingMinimal.length > 0) {
          setError(
            "File cannot be processed. Missing required headers: " +
              missingMinimal.join(", ")
          );
          setRows(null);
          return;
        }

        // If headers are valid, build filtered rows (this will pick columns by header indices)
        const filtered = buildFilteredRows(extracted);
        setRows(filtered.length > 1 ? filtered : null);
        if (filtered.length <= 1) {
          setError(
            "No recognizable student rows found. Ensure the file contains at least one data row."
          );
        }
      } catch (err) {
        setError("Failed to parse file.");
        console.error(err);
      }
    };

    reader.onerror = () => setError("Failed to read file.");
    reader.readAsArrayBuffer(file);
  };

  const doUpload = () => {
    if (!rows || rows.length <= 1) {
      setError("No student data to upload.");
      return;
    }
    if (onUpload) onUpload(rows);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>Upload Student List</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex gap-2 mb-3 min-w-100">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          <Button variant="outline-primary" onClick={downloadTemplate}>
            Download Format
          </Button>
          {fileName && <div className="ms-2 text-muted align-self-center">Selected: {fileName}</div>}
        </div>
        {error && <div className="text-danger mb-2">{error}</div>}
        {rows ? (
          <StudentTable
            rows={rows}
            maxPreviewRows={200}
            onUpdate={(newRows) => setRows(newRows)}
          />
        ) : (
          <div className="text-muted">No file parsed yet.</div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
        <Button variant="primary" onClick={doUpload} disabled={!rows || rows.length <= 1}>
          Confirm &amp; Upload
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StudentUploadModal;