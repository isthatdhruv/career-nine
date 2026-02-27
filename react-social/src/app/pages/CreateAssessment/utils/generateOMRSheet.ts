import jsPDF from "jspdf";
import { ReadQuestionnaireByAssessmentId } from "../API/Create_Assessment_APIs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionData {
  sectionName: string;
  maxOptionsAllowed: number;
  questions: { questionId: number; optionCount: number; maxOptionsAllowed: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bubble(doc: jsPDF, x: number, y: number, r: number, filled = false) {
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.25);
  if (filled) {
    doc.setFillColor(40, 40, 40);
    doc.circle(x, y, r, "FD");
  } else {
    doc.circle(x, y, r, "S");
  }
}

/** Draw a labeled write-in box with character cells */
function writeInField(doc: jsPDF, label: string, x: number, y: number, w: number, cells: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text(label, x, y);
  const boxY = y + 2;
  const boxH = 7;
  const cellW = w / cells;
  // Outer box
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(x, boxY, w, boxH);
  // Cell dividers
  doc.setLineWidth(0.15);
  doc.setDrawColor(180);
  for (let i = 1; i < cells; i++) {
    doc.line(x + i * cellW, boxY, x + i * cellW, boxY + boxH);
  }
  return boxY + boxH + 2; // return y after field
}

/** Draw a digit bubble grid (0-9 rows × N columns) for numeric fields */
function digitGrid(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  numDigits: number,
  cellSize: number
): number {
  const gridW = numDigits * cellSize;
  const bR = cellSize * 0.3; // bubble radius relative to cell

  // Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text(label, x, y);
  const gridY = y + 3;

  // Header cells (write-in boxes)
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(x, gridY, gridW, cellSize);
  doc.setLineWidth(0.15);
  doc.setDrawColor(150);
  for (let c = 1; c < numDigits; c++) {
    doc.line(x + c * cellSize, gridY, x + c * cellSize, gridY + cellSize);
  }

  // Digit rows 0-9
  const startRow = gridY + cellSize + 1;
  for (let r = 0; r < 10; r++) {
    const ry = startRow + r * (cellSize - 0.5);
    // Row digit label
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(String(r), x - 3, ry + bR * 0.4, { align: "center" });
    // Bubbles
    for (let c = 0; c < numDigits; c++) {
      const cx = x + c * cellSize + cellSize / 2;
      bubble(doc, cx, ry, bR);
    }
  }

  return startRow + 10 * (cellSize - 0.5) + 2;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function generateOMRSheet(assessmentId: number, assessmentName: string) {
  // 1. Fetch questionnaire
  const res = await ReadQuestionnaireByAssessmentId(assessmentId);
  const questionnaireArr = res.data;
  const questionnaire = Array.isArray(questionnaireArr) ? questionnaireArr[0] : questionnaireArr;

  console.log("OMR: Questionnaire response keys:", questionnaire ? Object.keys(questionnaire) : "null");

  const qSectionList = questionnaire?.section || questionnaire?.sections || [];
  if (!questionnaire || qSectionList.length === 0) {
    alert("This assessment has no questionnaire/sections configured.");
    return;
  }

  // 2. Parse sections
  const sections: SectionData[] = [];
  const sortedSections = [...qSectionList].sort(
    (a: any, b: any) => parseInt(a.orderIndex || a.order || "0") - parseInt(b.orderIndex || b.order || "0")
  );

  for (const qs of sortedSections) {
    const sectionInfo = qs.section;
    const qQuestions = qs.questions || qs.question || [];
    const sorted = [...qQuestions].sort(
      (a: any, b: any) => parseInt(a.orderIndex || a.order || "0") - parseInt(b.orderIndex || b.order || "0")
    );

    const questions = sorted.map((qq: any) => {
      const q = qq.question;
      const optCount = q?.options?.length || 4; // default 4 if options not loaded
      return {
        questionId: q?.questionId || 0,
        optionCount: optCount,
        maxOptionsAllowed: q?.maxOptionsAllowed || 1,
      };
    });

    sections.push({
      sectionName: sectionInfo?.sectionName || "Section",
      maxOptionsAllowed: questions.length > 0 ? Math.max(...questions.map((q) => q.maxOptionsAllowed)) : 1,
      questions,
    });
  }

  // 3. Create PDF
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let curY = MARGIN;

  // ═══════════════════════════════════════════════════════════════════════════
  //  HEADER BOX
  // ═══════════════════════════════════════════════════════════════════════════

  const headerH = 24;
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(MARGIN, curY, CONTENT_W, headerH);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text("Career-9 NAVIGATOR 360", PAGE_W / 2, curY + 7, { align: "center" });
  doc.setFontSize(11);
  doc.text("OMR ANSWER SHEET", PAGE_W / 2, curY + 13, { align: "center" });

  // Assessment name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Assessment: ${assessmentName}`, PAGE_W / 2, curY + 18, { align: "center" });

  // Marking guide (bottom-left of header)
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  const guideY = curY + 22;
  doc.text("WRONG:", MARGIN + 3, guideY);
  const wx = MARGIN + 19;
  bubble(doc, wx, guideY - 1, 2);
  doc.setLineWidth(0.5);
  doc.line(wx - 1.4, guideY - 2.4, wx + 1.4, guideY + 0.4);
  doc.line(wx - 1.4, guideY + 0.4, wx + 1.4, guideY - 2.4);

  doc.text("CORRECT:", MARGIN + 28, guideY);
  bubble(doc, MARGIN + 45, guideY - 1, 2, true);

  curY += headerH + 4;

  // ═══════════════════════════════════════════════════════════════════════════
  //  STUDENT INFO — Row 1: First Name + Last Name (full width)
  // ═══════════════════════════════════════════════════════════════════════════

  const halfW = (CONTENT_W - 6) / 2; // 6mm gap between columns

  curY = writeInField(doc, "FIRST NAME", MARGIN, curY, halfW, 15);
  const lastNameEndY = writeInField(doc, "LAST NAME", MARGIN + halfW + 6, curY - 9, halfW, 15);
  curY = Math.max(curY, lastNameEndY);

  curY += 2;

  // ═══════════════════════════════════════════════════════════════════════════
  //  STUDENT INFO — Row 2: Mobile Number (left) + Roll Number (right)
  // ═══════════════════════════════════════════════════════════════════════════

  const leftX = MARGIN;
  const rightX = MARGIN + halfW + 6;
  const cellSz = 7; // cell size for digit grid

  const mobileEndY = digitGrid(doc, "MOBILE NUMBER", leftX, curY, 10, cellSz);
  const rollEndY = digitGrid(doc, "ROLL NUMBER", rightX, curY, 8, cellSz);
  curY = Math.max(mobileEndY, rollEndY) + 2;

  // ═══════════════════════════════════════════════════════════════════════════
  //  STUDENT INFO — Row 3: Grade/Class + Signatures
  // ═══════════════════════════════════════════════════════════════════════════

  // Grade/Class
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text("GRADE / CLASS", leftX, curY);
  curY += 4;

  const grades = ["6th", "7th", "8th", "9th", "10th", "11th", "12th"];
  const gradeGap = halfW / grades.length;
  grades.forEach((g, i) => {
    const gx = leftX + 3 + i * gradeGap;
    bubble(doc, gx, curY, 2);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(g, gx + 4, curY + 0.5);
  });
  curY += 7;

  // Signatures (side by side)
  const sigBoxW = halfW - 2;
  const sigBoxH = 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Student Signature", leftX, curY);
  doc.text("Invigilator Signature", rightX, curY);
  curY += 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(leftX, curY, sigBoxW, sigBoxH);
  doc.rect(rightX, curY, sigBoxW, sigBoxH);
  curY += sigBoxH + 4;

  // Thick divider
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.line(MARGIN, curY, PAGE_W - MARGIN, curY);
  curY += 5;

  // ═══════════════════════════════════════════════════════════════════════════
  //  DYNAMIC SECTIONS — Question Grids
  // ═══════════════════════════════════════════════════════════════════════════

  const OPT_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const ROW_H = 7;
  const BUBBLE_R = 2.2;
  const SNUM_W = 12; // S.No. column width

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const sLetter = String.fromCharCode(65 + sIdx);
    const maxOpts = Math.max(...section.questions.map((q) => q.optionCount), 4);
    const optColW = Math.min((CONTENT_W - SNUM_W) / maxOpts, 14); // cap column width

    // Space check
    const neededH = 10 + ROW_H + section.questions.length * ROW_H + 4;
    if (curY + Math.min(neededH, 40) > PAGE_H - 12) {
      doc.addPage();
      curY = MARGIN;
    }

    // Section header bar
    doc.setFillColor(60, 60, 60);
    doc.rect(MARGIN, curY, CONTENT_W, 8, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, curY, CONTENT_W, 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`Section ${sLetter}: ${section.sectionName}`, MARGIN + 4, curY + 5.5);

    // Instruction
    const maxAllowed = section.maxOptionsAllowed;
    const instruction = maxAllowed > 1 ? `Select Top ${maxAllowed}` : "Mark any 1 Answer";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(instruction, MARGIN + CONTENT_W - 4, curY + 5.5, { align: "right" });

    curY += 9;

    // Column header row
    doc.setFillColor(230, 230, 230);
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, curY, CONTENT_W, ROW_H, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.text("S.No.", MARGIN + SNUM_W / 2, curY + ROW_H / 2 + 1, { align: "center" });

    // Vertical line after S.No.
    doc.line(MARGIN + SNUM_W, curY, MARGIN + SNUM_W, curY + ROW_H);

    for (let o = 0; o < maxOpts; o++) {
      const ox = MARGIN + SNUM_W + (o + 0.5) * optColW;
      doc.text(OPT_LABELS[o] || String(o + 1), ox, curY + ROW_H / 2 + 1, { align: "center" });
    }
    curY += ROW_H;

    // Question rows
    for (let qIdx = 0; qIdx < section.questions.length; qIdx++) {
      const q = section.questions[qIdx];

      // Page break mid-section
      if (curY + ROW_H > PAGE_H - 10) {
        doc.addPage();
        curY = MARGIN;
        // Continuation header
        doc.setFillColor(60, 60, 60);
        doc.rect(MARGIN, curY, CONTENT_W, 6, "F");
        doc.rect(MARGIN, curY, CONTENT_W, 6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(255);
        doc.text(`Section ${sLetter} (continued)`, MARGIN + 4, curY + 4);
        curY += 7;
      }

      // Alternating row background
      if (qIdx % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(MARGIN, curY, CONTENT_W, ROW_H, "F");
      }

      // Row border
      doc.setDrawColor(180);
      doc.setLineWidth(0.15);
      doc.rect(MARGIN, curY, CONTENT_W, ROW_H);

      // S.No. separator
      doc.setDrawColor(180);
      doc.line(MARGIN + SNUM_W, curY, MARGIN + SNUM_W, curY + ROW_H);

      // Question number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(0);
      doc.text(String(qIdx + 1), MARGIN + SNUM_W / 2, curY + ROW_H / 2 + 1, { align: "center" });

      // Option bubbles
      const numBubbles = Math.max(q.optionCount, maxOpts); // always show all columns
      for (let o = 0; o < numBubbles; o++) {
        const ox = MARGIN + SNUM_W + (o + 0.5) * optColW;
        bubble(doc, ox, curY + ROW_H / 2, BUBBLE_R);
      }

      curY += ROW_H;
    }

    curY += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════════════════════════════════════════

  if (curY + 12 > PAGE_H - 5) {
    doc.addPage();
    curY = MARGIN;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, curY, PAGE_W - MARGIN, curY);
  curY += 5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Fill bubbles completely using a dark pen. Do not fold or damage this sheet.", PAGE_W / 2, curY, { align: "center" });
  curY += 4;
  doc.text("Career-9 NAVIGATOR 360 | Powered by Career-9", PAGE_W / 2, curY, { align: "center" });

  // 4. Save
  const sanitizedName = assessmentName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`OMR_${sanitizedName}.pdf`);
}
