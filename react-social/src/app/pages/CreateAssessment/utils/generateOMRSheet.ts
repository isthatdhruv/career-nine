import jsPDF from "jspdf";
import { ReadQuestionnaireByAssessmentId } from "../API/Create_Assessment_APIs";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionData {
  sectionName: string;
  maxOptionsAllowed: number;
  questions: { questionId: number; optionCount: number; maxOptionsAllowed: number }[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 7;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Theme color (pink/magenta matching reference)
const TR = 140, TG = 30, TB = 90;

// ─── Helpers ────────────────────────────────────────────────────────────────

function setTheme(doc: jsPDF) {
  doc.setDrawColor(TR, TG, TB);
  doc.setTextColor(TR, TG, TB);
}

function bubble(doc: jsPDF, x: number, y: number, r: number, filled = false) {
  doc.setDrawColor(TR, TG, TB);
  doc.setLineWidth(0.25);
  if (filled) {
    doc.setFillColor(TR, TG, TB);
    doc.circle(x, y, r, "FD");
  } else {
    doc.circle(x, y, r, "S");
  }
}

function digitGrid(doc: jsPDF, label: string, x: number, y: number, cols: number, cs: number): number {
  const bR = cs * 0.3;
  const rowStep = cs * 0.75; // tighter vertical spacing for bubble rows

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  setTheme(doc);
  doc.text(label, x + (cols * cs) / 2, y, { align: "center" });

  const gy = y + 2.5;
  doc.setDrawColor(TR, TG, TB);
  doc.setLineWidth(0.4);
  doc.rect(x, gy, cols * cs, cs);
  doc.setLineWidth(0.15);
  for (let c = 1; c < cols; c++) doc.line(x + c * cs, gy, x + c * cs, gy + cs);

  const startRow = gy + cs + bR + 1.5; // enough gap so bubbles don't overlap header boxes
  for (let r = 0; r < 10; r++) {
    const ry = startRow + r * rowStep;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.5);
    doc.setTextColor(TR, TG, TB);
    doc.text(String(r), x - 2, ry + bR * 0.35, { align: "center" });
    for (let c = 0; c < cols; c++) bubble(doc, x + c * cs + cs / 2, ry, bR);
  }
  return startRow + 10 * rowStep + 1;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function generateOMRSheet(assessmentId: number, assessmentName: string) {
  /* 1. Fetch questionnaire */
  const res = await ReadQuestionnaireByAssessmentId(assessmentId);
  const raw = res.data;
  const questionnaire = Array.isArray(raw) ? raw[0] : raw;
  const qSectionList = questionnaire?.section || questionnaire?.sections || [];
  if (!questionnaire || qSectionList.length === 0) {
    alert("This assessment has no questionnaire/sections configured.");
    return;
  }

  /* 2. Parse sections */
  const sections: SectionData[] = [];
  const sorted = [...qSectionList].sort(
    (a: any, b: any) => parseInt(a.orderIndex || a.order || "0") - parseInt(b.orderIndex || b.order || "0")
  );
  for (const qs of sorted) {
    const info = qs.section;
    const qqList = [...(qs.questions || qs.question || [])].sort(
      (a: any, b: any) => parseInt(a.orderIndex || a.order || "0") - parseInt(b.orderIndex || b.order || "0")
    );
    const questions = qqList.map((qq: any) => {
      const q = qq.question;
      return {
        questionId: q?.questionId || 0,
        optionCount: q?.options?.length || 4,
        maxOptionsAllowed: q?.maxOptionsAllowed || 1,
      };
    });
    sections.push({
      sectionName: info?.sectionName || "Section",
      maxOptionsAllowed: questions.length > 0 ? Math.max(...questions.map((q) => q.maxOptionsAllowed)) : 1,
      questions,
    });
  }

  /* 3. Create PDF */
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let curY = MARGIN;

  // ═══════════════════════════════════════════════════════════════════════
  //  TITLE BAR
  // ═══════════════════════════════════════════════════════════════════════
  const titleH = 16;
  doc.setDrawColor(TR, TG, TB);
  doc.setLineWidth(0.8);
  doc.rect(MARGIN, curY, CONTENT_W, titleH);

  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TR, TG, TB);
  doc.text("Career-9", MARGIN + 3, curY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4);
  doc.text("ENSURING CAREER SUCCESS", MARGIN + 3, curY + 9.5);

  // Center title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("NAVIGATOR 360", PAGE_W / 2, curY + 6, { align: "center" });
  doc.setFontSize(9);
  doc.text("OMR ANSWER SHEET", PAGE_W / 2, curY + 11, { align: "center" });

  // Wrong marking guide (right)
  const gmX = PAGE_W - MARGIN - 52;
  doc.setLineWidth(0.3);
  doc.setDrawColor(TR, TG, TB);
  doc.rect(gmX, curY + 1.5, 23, 13);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TR, TG, TB);
  doc.text("Wrong Marking", gmX + 11.5, curY + 5, { align: "center" });
  bubble(doc, gmX + 11.5, curY + 10, 2);
  doc.setLineWidth(0.5);
  doc.setDrawColor(TR, TG, TB);
  doc.line(gmX + 10, curY + 8.5, gmX + 13, curY + 11.5);
  doc.line(gmX + 10, curY + 11.5, gmX + 13, curY + 8.5);

  // Correct marking guide
  const cmX = gmX + 25;
  doc.setLineWidth(0.3);
  doc.setDrawColor(TR, TG, TB);
  doc.rect(cmX, curY + 1.5, 25, 13);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TR, TG, TB);
  doc.text("Correct Marking", cmX + 12.5, curY + 5, { align: "center" });
  const cLabels = ["A", "B", "C", "D"];
  for (let i = 0; i < 4; i++) {
    const bx = cmX + 4 + i * 5.5;
    bubble(doc, bx, curY + 10, 2, true);
    doc.setFontSize(3.5);
    doc.setTextColor(255, 255, 255);
    doc.text(cLabels[i], bx, curY + 10.8, { align: "center" });
  }

  curY += titleH + 2;

  // ═══════════════════════════════════════════════════════════════════════
  //  NAME FIELDS
  // ═══════════════════════════════════════════════════════════════════════
  const nameH = 7;
  const halfW = (CONTENT_W - 6) / 2;

  // First Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(TR, TG, TB);
  doc.text("First Name", MARGIN, curY + 4);
  const fnX = MARGIN + 20;
  const fnW = halfW - 20;
  doc.setDrawColor(TR, TG, TB);
  doc.setLineWidth(0.4);
  doc.rect(fnX, curY, fnW, nameH);
  doc.setLineWidth(0.12);
  const fnCells = Math.floor(fnW / 5);
  for (let i = 1; i < fnCells; i++) doc.line(fnX + i * (fnW / fnCells), curY, fnX + i * (fnW / fnCells), curY + nameH);

  // Last Name
  const lnLabelX = MARGIN + halfW + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(TR, TG, TB);
  doc.text("Last Name", lnLabelX, curY + 4);
  const lnX = lnLabelX + 19;
  const lnW = halfW - 19;
  doc.setLineWidth(0.4);
  doc.rect(lnX, curY, lnW, nameH);
  doc.setLineWidth(0.12);
  const lnCells = Math.floor(lnW / 5);
  for (let i = 1; i < lnCells; i++) doc.line(lnX + i * (lnW / lnCells), curY, lnX + i * (lnW / lnCells), curY + nameH);

  curY += nameH + 3;

  // ═══════════════════════════════════════════════════════════════════════
  //  INFO ROW: Mobile | Roll Number | Grade/Class | Signatures
  // ═══════════════════════════════════════════════════════════════════════
  const cs = 4.2; // cell size for digit grids

  // Mobile Number (left)
  const mobileEndY = digitGrid(doc, "MOBILE NUMBER", MARGIN, curY, 10, cs);

  // Roll Number
  const rollX = MARGIN + 10 * cs + 6;
  const rollEndY = digitGrid(doc, "ROLL NUMBER", rollX, curY, 7, cs);

  // Grade/Class
  const gradeX = rollX + 7 * cs + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(TR, TG, TB);
  doc.text("GRADE/CLASS", gradeX, curY);
  const grades = ["6th", "7th", "8th", "9th", "10th", "11th", "12th"];
  const gradeGap = 5;
  for (let i = 0; i < grades.length; i++) {
    const gy = curY + 4 + i * gradeGap;
    bubble(doc, gradeX + 3, gy, 1.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(TR, TG, TB);
    doc.text(grades[i], gradeX + 7, gy + 0.5);
  }

  // Signatures (right)
  const sigX = gradeX + 25;
  const sigW = PAGE_W - MARGIN - sigX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(TR, TG, TB);

  doc.text("STUDENT SIGNATURE", sigX, curY);
  doc.setDrawColor(TR, TG, TB);
  doc.setLineWidth(0.4);
  doc.rect(sigX, curY + 2, sigW, 16);

  doc.text("INVIGILATOR SIGNATURE", sigX, curY + 22);
  doc.rect(sigX, curY + 24, sigW, 16);

  curY = Math.max(mobileEndY, rollEndY, curY + 4 + grades.length * gradeGap) + 2;

  // Divider
  doc.setDrawColor(TR, TG, TB);
  doc.setLineWidth(1);
  doc.line(MARGIN, curY, PAGE_W - MARGIN, curY);
  curY += 3;

  // ═══════════════════════════════════════════════════════════════════════
  //  DYNAMIC SECTIONS — Columns Side by Side
  // ═══════════════════════════════════════════════════════════════════════
  const OPT_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const SEC_HDR_H = 6.5;
  const COL_HDR_H = 6;
  const FOOTER_SPACE = 6;
  const availH = PAGE_H - curY - MARGIN - FOOTER_SPACE;

  // Group consecutive 1-question sections into merged visual columns
  type VisualCol = { type: "merged"; entries: { sec: SectionData; idx: number }[] }
    | { type: "multi"; sec: SectionData; idx: number };

  const visCols: VisualCol[] = [];
  let si = 0;
  while (si < sections.length) {
    if (sections[si].questions.length === 1) {
      const group: { sec: SectionData; idx: number }[] = [];
      while (si < sections.length && sections[si].questions.length === 1) {
        group.push({ sec: sections[si], idx: si });
        si++;
      }
      visCols.push({ type: "merged", entries: group });
    } else {
      visCols.push({ type: "multi", sec: sections[si], idx: si });
      si++;
    }
  }

  // Column width allocation
  const GAP = 1.5;
  const totalGaps = (visCols.length - 1) * GAP;
  const availW = CONTENT_W - totalGaps;
  const SN_WT = 1.5;

  const colWeights = visCols.map((vc) => {
    if (vc.type === "merged") {
      return SN_WT + vc.entries.length; // S.N. + one bubble column per section
    }
    const maxOpts = Math.max(...vc.sec.questions.map((q) => q.optionCount), 2);
    return SN_WT + maxOpts;
  });
  const totalWt = colWeights.reduce((a, b) => a + b, 0);
  const colWidths = colWeights.map((w) => (w / totalWt) * availW);

  // Row height based on tallest visual column
  const effectiveRows = visCols.map((vc) => {
    if (vc.type === "merged") {
      return Math.max(...vc.entries.map((e) => e.sec.questions[0].optionCount));
    }
    return vc.sec.questions.length;
  });
  const maxQ = Math.max(...effectiveRows);
  const rowH = Math.min(Math.max((availH - SEC_HDR_H - COL_HDR_H) / maxQ, 3.5), 7);

  let colX = MARGIN;
  for (let vcIdx = 0; vcIdx < visCols.length; vcIdx++) {
    const vc = visCols[vcIdx];
    const colW = colWidths[vcIdx];
    const weight = colWeights[vcIdx];
    const snW = colW * (SN_WT / weight);
    let sy = curY;

    if (vc.type === "merged") {
      // ══ MERGED 1-question sections: shared S.N. + bubble column per section ══
      const numSec = vc.entries.length;
      const secColW = (colW - snW) / numSec;
      const maxOpts = Math.max(...vc.entries.map((e) => e.sec.questions[0].optionCount));
      const bR = Math.min(rowH * 0.3, secColW * 0.35, 2.5);
      const sLetters = vc.entries.map((e) => String.fromCharCode(65 + e.idx));

      // Header label: "SECTION - A, B & C"
      const headerLabel = numSec === 1
        ? `SECTION - ${sLetters[0]}`
        : numSec === 2
          ? `SECTION - ${sLetters[0]} & ${sLetters[1]}`
          : `SECTION - ${sLetters.slice(0, -1).join(", ")} & ${sLetters[sLetters.length - 1]}`;

      // Section header bar
      doc.setFillColor(TR, TG, TB);
      doc.rect(colX, sy, colW, SEC_HDR_H, "F");
      doc.setDrawColor(TR, TG, TB);
      doc.setLineWidth(0.3);
      doc.rect(colX, sy, colW, SEC_HDR_H);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.text(headerLabel, colX + 1.5, sy + 4);
      sy += SEC_HDR_H;

      // Column headers: S.N. | A (instruction) | B (instruction) | ...
      doc.setFillColor(250, 230, 240);
      doc.rect(colX, sy, colW, COL_HDR_H, "F");
      doc.setDrawColor(TR, TG, TB);
      doc.setLineWidth(0.2);
      doc.rect(colX, sy, colW, COL_HDR_H);
      doc.line(colX + snW, sy, colX + snW, sy + COL_HDR_H);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.5);
      doc.setTextColor(TR, TG, TB);
      doc.text("S.N.", colX + snW / 2, sy + COL_HDR_H / 2 + 0.5, { align: "center" });

      for (let s = 0; s < numSec; s++) {
        const sx = colX + snW + s * secColW;
        if (s > 0) doc.line(sx, sy, sx, sy + COL_HDR_H);
        // Section letter
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.5);
        doc.text(sLetters[s], sx + secColW / 2, sy + 2.2, { align: "center" });
        // Instruction below
        const entry = vc.entries[s].sec;
        const instr = entry.maxOptionsAllowed > 1 ? `Select Top ${entry.maxOptionsAllowed}` : "Mark 1";
        doc.setFont("helvetica", "normal");
        doc.setFontSize(3);
        doc.text(instr, sx + secColW / 2, sy + 4.8, { align: "center" });
      }
      sy += COL_HDR_H;

      // Rows: shared S.N. + one bubble per section column
      for (let r = 0; r < maxOpts; r++) {
        if (r % 2 === 0) {
          doc.setFillColor(253, 247, 250);
          doc.rect(colX, sy, colW, rowH, "F");
        }
        doc.setDrawColor(TR, TG, TB);
        doc.setLineWidth(0.08);
        doc.rect(colX, sy, colW, rowH);
        doc.line(colX + snW, sy, colX + snW, sy + rowH);

        // S.N.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.5);
        doc.setTextColor(TR, TG, TB);
        doc.text(String(r + 1), colX + snW / 2, sy + rowH / 2 + 0.7, { align: "center" });

        // One bubble per section column
        for (let s = 0; s < numSec; s++) {
          const sx = colX + snW + s * secColW;
          if (s > 0) doc.line(sx, sy, sx, sy + rowH);
          // Only draw bubble if this section has enough options
          if (r < vc.entries[s].sec.questions[0].optionCount) {
            bubble(doc, sx + secColW / 2, sy + rowH / 2, bR);
          }
        }
        sy += rowH;
      }

    } else {
      // ══ MULTI-QUESTION section: rows = questions, columns = options ══
      const sec = vc.sec;
      const sLetter = String.fromCharCode(65 + vc.idx);
      const maxOpts = Math.max(...sec.questions.map((q) => q.optionCount), 2);
      const optAreaW = colW - snW;
      const optColW = optAreaW / maxOpts;
      const bR = Math.min(rowH * 0.3, optColW * 0.36, 2.5);

      // Section header bar
      doc.setFillColor(TR, TG, TB);
      doc.rect(colX, sy, colW, SEC_HDR_H, "F");
      doc.setDrawColor(TR, TG, TB);
      doc.setLineWidth(0.3);
      doc.rect(colX, sy, colW, SEC_HDR_H);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`SECTION - ${sLetter}`, colX + 1.5, sy + 3);
      const instruction = sec.maxOptionsAllowed > 1 ? `(Select Top ${sec.maxOptionsAllowed})` : "(Mark any 1 Answer)";
      doc.setFontSize(4);
      doc.setFont("helvetica", "normal");
      doc.text(instruction, colX + colW - 1.5, sy + 3, { align: "right" });
      doc.setFontSize(3.5);
      const maxChars = Math.max(Math.floor(colW / 2), 8);
      doc.text(sec.sectionName.substring(0, maxChars), colX + 1.5, sy + 5.5);
      sy += SEC_HDR_H;

      // Column headers: S.N. | A | B | C | D ...
      doc.setFillColor(250, 230, 240);
      doc.rect(colX, sy, colW, COL_HDR_H, "F");
      doc.setDrawColor(TR, TG, TB);
      doc.setLineWidth(0.2);
      doc.rect(colX, sy, colW, COL_HDR_H);
      doc.line(colX + snW, sy, colX + snW, sy + COL_HDR_H);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.5);
      doc.setTextColor(TR, TG, TB);
      doc.text("S.N.", colX + snW / 2, sy + COL_HDR_H / 2 + 0.5, { align: "center" });

      for (let o = 0; o < maxOpts; o++) {
        const ox = colX + snW + (o + 0.5) * optColW;
        if (o > 0) doc.line(colX + snW + o * optColW, sy, colX + snW + o * optColW, sy + COL_HDR_H);
        doc.text(OPT_LABELS[o] || String(o + 1), ox, sy + COL_HDR_H / 2 + 0.5, { align: "center" });
      }
      sy += COL_HDR_H;

      // Question rows
      for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
        if (qIdx % 2 === 0) {
          doc.setFillColor(253, 247, 250);
          doc.rect(colX, sy, colW, rowH, "F");
        }
        doc.setDrawColor(TR, TG, TB);
        doc.setLineWidth(0.08);
        doc.rect(colX, sy, colW, rowH);
        doc.line(colX + snW, sy, colX + snW, sy + rowH);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.5);
        doc.setTextColor(TR, TG, TB);
        doc.text(String(qIdx + 1), colX + snW / 2, sy + rowH / 2 + 0.7, { align: "center" });

        for (let o = 0; o < maxOpts; o++) {
          const ox = colX + snW + (o + 0.5) * optColW;
          bubble(doc, ox, sy + rowH / 2, bR);
        }
        sy += rowH;
      }
    }

    // Outer border for visual column
    doc.setDrawColor(TR, TG, TB);
    doc.setLineWidth(0.4);
    doc.rect(colX, curY, colW, sy - curY);

    colX += colW + GAP;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "italic");
  doc.setFontSize(4.5);
  doc.setTextColor(130, 130, 130);
  doc.text(
    "Fill bubbles completely using a dark pen. Do not fold or damage this sheet. | Career-9 NAVIGATOR 360",
    PAGE_W / 2,
    PAGE_H - MARGIN - 1,
    { align: "center" }
  );

  /* 4. Save */
  const sanitizedName = assessmentName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`OMR_${sanitizedName}.pdf`);
}
