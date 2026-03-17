import jsPDF from "jspdf";
import { ReadQuestionnaireByAssessmentId } from "../API/Create_Assessment_APIs";

// ─── Types ──────────────────────────────────────────────────────────────────

interface LanguageOption {
  LanguageOptionId: number;
  LanguageoptionText: string;
  assessmentOption?: { optionId: number };
  language?: { id: number; languageName: string };
}

interface LanguageQuestion {
  LanguageQuestionId: number;
  QuestionText: string;
  language?: { id: number; languageName: string };
  options?: LanguageOption[];
}

interface OptionData {
  optionId: number;
  optionText: string;
}

interface QuestionData {
  questionId: number;
  questionText: string;
  options: OptionData[];
  languageQuestions?: LanguageQuestion[];
}

interface SectionData {
  sectionName: string;
  sectionDescription?: string;
  maxOptionsAllowed: number;
  instructions?: { language?: { languageName: string }; instructionText: string }[];
  questions: {
    questionId: number;
    questionText: string;
    optionCount: number;
    maxOptionsAllowed: number;
    options: OptionData[];
    languageQuestions?: LanguageQuestion[];
  }[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Theme colors
const PRIMARY_R = 140, PRIMARY_G = 30, PRIMARY_B = 90;
const TEXT_R = 30, TEXT_G = 30, TEXT_B = 30;
const LIGHT_BG_R = 248, LIGHT_BG_G = 245, LIGHT_BG_B = 250;

// ─── Helpers ────────────────────────────────────────────────────────────────

const OPT_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function addPageFooter(doc: jsPDF, pageNum: number, assessmentName: string) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${assessmentName} | Career-9 NAVIGATOR 360 | Page ${pageNum}`,
    PAGE_W / 2,
    PAGE_H - 6,
    { align: "center" }
  );
}

function checkPageBreak(doc: jsPDF, curY: number, needed: number, pageNum: { val: number }, assessmentName: string): number {
  if (curY + needed > PAGE_H - 15) {
    addPageFooter(doc, pageNum.val, assessmentName);
    doc.addPage();
    pageNum.val++;
    return MARGIN + 5;
  }
  return curY;
}

/** Wrap text to fit within maxWidth, returns array of lines */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function generateQuestionnairePDF(assessmentId: number, assessmentName: string) {
  /* 1. Fetch questionnaire */
  const res = await ReadQuestionnaireByAssessmentId(assessmentId);
  const raw = res.data;
  const questionnaire = Array.isArray(raw) ? raw[0] : raw;
  const qSectionList = questionnaire?.section || questionnaire?.sections || [];

  if (!questionnaire || qSectionList.length === 0) {
    alert("This assessment has no questionnaire/sections configured.");
    return;
  }

  // Gather available languages from questionnaire
  const languageSet = new Set<string>();
  const qLanguages = questionnaire?.questionnaireLanguage || questionnaire?.languages || [];
  for (const ql of qLanguages) {
    const langName = ql?.language?.languageName;
    if (langName && langName.toLowerCase() !== "english") {
      languageSet.add(langName);
    }
  }
  const secondaryLanguages = Array.from(languageSet);

  /* 2. Parse sections */
  const sections: SectionData[] = [];
  const sorted = [...qSectionList].sort(
    (a: any, b: any) => parseInt(a.orderIndex || a.order || "0") - parseInt(b.orderIndex || b.order || "0")
  );

  for (const qs of sorted) {
    const info = qs.section;
    const sectionInstructions = qs.questionnaire_section_instruction || qs.instructions || [];
    const qqList = [...(qs.questions || qs.question || [])].sort(
      (a: any, b: any) => parseInt(a.orderIndex || a.order || "0") - parseInt(b.orderIndex || b.order || "0")
    );

    const questions = qqList.map((qq: any) => {
      const q = qq.question;
      const opts: OptionData[] = (q?.options || [])
        .slice()
        .sort((a: any, b: any) => (a.optionId || 0) - (b.optionId || 0))
        .map((opt: any) => ({
          optionId: opt.optionId,
          optionText: opt.optionText || "",
        }));
      return {
        questionId: q?.questionId || 0,
        questionText: q?.questionText || "",
        optionCount: opts.length,
        maxOptionsAllowed: q?.maxOptionsAllowed || 1,
        options: opts,
        languageQuestions: q?.languageQuestions || [],
      };
    });

    sections.push({
      sectionName: info?.sectionName || "Section",
      sectionDescription: info?.sectionDescription || "",
      maxOptionsAllowed: questions.length > 0 ? Math.max(...questions.map((q: any) => q.maxOptionsAllowed)) : 1,
      instructions: sectionInstructions,
      questions,
    });
  }

  /* 3. Create PDF */
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageNum = { val: 1 };
  let curY = MARGIN;

  // ═══════════════════════════════════════════════════════════════════════
  //  TITLE PAGE HEADER
  // ═══════════════════════════════════════════════════════════════════════
  const titleH = 18;
  doc.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  doc.rect(MARGIN, curY, CONTENT_W, titleH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("NAVIGATOR 360", PAGE_W / 2, curY + 7, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("QUESTION BOOKLET", PAGE_W / 2, curY + 12, { align: "center" });
  doc.setFontSize(7);
  doc.text("Career-9 | Ensuring Career Success", PAGE_W / 2, curY + 16, { align: "center" });

  curY += titleH + 4;

  // Assessment name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  doc.text(`Assessment: ${assessmentName}`, MARGIN, curY + 4);
  curY += 8;

  // Instructions box
  doc.setFillColor(LIGHT_BG_R, LIGHT_BG_G, LIGHT_BG_B);
  doc.setDrawColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  doc.setLineWidth(0.3);
  const instrBoxY = curY;
  const instrLines = [
    "GENERAL INSTRUCTIONS:",
    "1. Read each question carefully before marking your answer on the OMR sheet.",
    "2. Use a dark pen or pencil to fill the bubbles completely on the OMR sheet.",
    "3. Do not make any marks on this question booklet.",
    "4. Each section has specific instructions - read them before answering.",
    `5. Total Sections: ${sections.length} | Total Questions: ${sections.reduce((sum, s) => sum + s.questions.length, 0)}`,
  ];
  const instrH = instrLines.length * 5 + 6;
  doc.rect(MARGIN, curY, CONTENT_W, instrH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  doc.text(instrLines[0], MARGIN + 3, curY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
  for (let i = 1; i < instrLines.length; i++) {
    doc.text(instrLines[i], MARGIN + 3, curY + 5 + i * 5);
  }
  curY += instrH + 5;

  // Section overview table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  doc.text("SECTION OVERVIEW:", MARGIN, curY + 3);
  curY += 6;

  const tableColWidths = [15, 60, 25, 40, CONTENT_W - 140];
  const tableHeaders = ["S.No.", "Section Name", "Questions", "Answer Type", "Instructions"];

  // Table header
  doc.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  let txStart = MARGIN;
  for (let c = 0; c < tableHeaders.length; c++) {
    doc.rect(txStart, curY, tableColWidths[c], 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(tableHeaders[c], txStart + 2, curY + 4);
    txStart += tableColWidths[c];
  }
  curY += 6;

  // Table rows
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const sLetter = String.fromCharCode(65 + si);
    const ansType = sec.questions.length === 1
      ? `Select from ${sec.questions[0].optionCount} options`
      : sec.maxOptionsAllowed > 1
        ? `Select Top ${sec.maxOptionsAllowed}`
        : sec.questions[0]?.options.length === 2
          ? "Yes / No"
          : `Choose 1 of ${sec.questions[0]?.options.length || "N"} options`;

    const rowH = 5;
    if (si % 2 === 0) {
      doc.setFillColor(LIGHT_BG_R, LIGHT_BG_G, LIGHT_BG_B);
      doc.rect(MARGIN, curY, CONTENT_W, rowH, "F");
    }
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.rect(MARGIN, curY, CONTENT_W, rowH);

    txStart = MARGIN;
    const rowData = [
      `${sLetter}`,
      sec.sectionName,
      String(sec.questions.length),
      ansType,
      sec.sectionDescription?.substring(0, 40) || "-",
    ];
    for (let c = 0; c < rowData.length; c++) {
      doc.setFont("helvetica", c === 0 ? "bold" : "normal");
      doc.setFontSize(6);
      doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
      doc.text(rowData[c], txStart + 2, curY + 3.5);
      txStart += tableColWidths[c];
    }
    curY += rowH;
  }

  curY += 8;

  // ═══════════════════════════════════════════════════════════════════════
  //  SECTIONS WITH QUESTIONS
  // ═══════════════════════════════════════════════════════════════════════

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const sLetter = String.fromCharCode(65 + si);
    const isMergedSection = sec.questions.length === 1;

    // Section header (needs ~15mm)
    curY = checkPageBreak(doc, curY, 20, pageNum, assessmentName);

    // Section header bar
    doc.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.rect(MARGIN, curY, CONTENT_W, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`SECTION ${sLetter}: ${sec.sectionName}`, MARGIN + 3, curY + 7);

    // Right-aligned info
    const infoText = isMergedSection
      ? `${sec.questions[0].optionCount} Options | Select ${sec.maxOptionsAllowed > 1 ? "Top " + sec.maxOptionsAllowed : "any 1"}`
      : `${sec.questions.length} Questions | ${sec.maxOptionsAllowed > 1 ? "Select Top " + sec.maxOptionsAllowed : "Mark 1 Answer"}`;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(infoText, PAGE_W - MARGIN - 2, curY + 7, { align: "right" });
    curY += 12;

    // Section instructions (from QuestionnaireSectionInstruction)
    if (sec.instructions && sec.instructions.length > 0) {
      for (const instr of sec.instructions) {
        if (instr.instructionText) {
          curY = checkPageBreak(doc, curY, 12, pageNum, assessmentName);
          const langLabel = instr.language?.languageName || "English";
          doc.setFillColor(LIGHT_BG_R, LIGHT_BG_G, LIGHT_BG_B);
          doc.setDrawColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
          doc.setLineWidth(0.2);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
          doc.text(`Instructions (${langLabel}):`, MARGIN + 2, curY + 3);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
          const instrWrapped = wrapText(doc, instr.instructionText, CONTENT_W - 6);
          const instrBoxH = instrWrapped.length * 3.5 + 6;
          doc.rect(MARGIN, curY, CONTENT_W, instrBoxH, "FD");
          doc.text(`Instructions (${langLabel}):`, MARGIN + 2, curY + 3);
          for (let li = 0; li < instrWrapped.length; li++) {
            doc.setFont("helvetica", "normal");
            doc.text(instrWrapped[li], MARGIN + 2, curY + 7 + li * 3.5);
          }
          curY += instrBoxH + 2;
        }
      }
    }

    // ── Questions ──

    if (isMergedSection) {
      // Single question with many options (like aptitude sections)
      const q = sec.questions[0];

      // Question text
      curY = checkPageBreak(doc, curY, 10, pageNum, assessmentName);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
      const qTextLines = wrapText(doc, q.questionText || "Select from the following options:", CONTENT_W - 4);
      for (const line of qTextLines) {
        curY = checkPageBreak(doc, curY, 5, pageNum, assessmentName);
        doc.text(line, MARGIN + 2, curY);
        curY += 4;
      }

      // Language translations for the question
      if (q.languageQuestions && q.languageQuestions.length > 0) {
        for (const lq of q.languageQuestions) {
          if (lq.QuestionText) {
            curY = checkPageBreak(doc, curY, 5, pageNum, assessmentName);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            const langLines = wrapText(doc, `(${lq.language?.languageName || "Translation"}) ${lq.QuestionText}`, CONTENT_W - 6);
            for (const line of langLines) {
              curY = checkPageBreak(doc, curY, 4, pageNum, assessmentName);
              doc.text(line, MARGIN + 4, curY);
              curY += 3.5;
            }
          }
        }
      }

      curY += 2;

      // Options in a numbered list
      for (let oi = 0; oi < q.options.length; oi++) {
        const opt = q.options[oi];
        const optHeight = 5;
        curY = checkPageBreak(doc, curY, optHeight + 2, pageNum, assessmentName);

        // Alternating background
        if (oi % 2 === 0) {
          doc.setFillColor(LIGHT_BG_R, LIGHT_BG_G, LIGHT_BG_B);
          doc.rect(MARGIN, curY - 1, CONTENT_W, optHeight, "F");
        }

        // Option number (matches OMR S.N.)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
        doc.text(`${oi + 1}.`, MARGIN + 3, curY + 2);

        // Option text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
        const optLines = wrapText(doc, opt.optionText, CONTENT_W - 15);
        doc.text(optLines[0], MARGIN + 10, curY + 2);

        // Language translations for option
        if (q.languageQuestions && q.languageQuestions.length > 0) {
          for (const lq of q.languageQuestions) {
            const langOpt = lq.options?.find(
              (lo: LanguageOption) => lo.assessmentOption?.optionId === opt.optionId
            );
            if (langOpt?.LanguageoptionText) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(120, 120, 120);
              doc.text(`(${langOpt.LanguageoptionText})`, MARGIN + 10, curY + 5);
              curY += 3;
            }
          }
        }

        curY += optHeight;
      }

    } else {
      // Multiple questions section
      for (let qi = 0; qi < sec.questions.length; qi++) {
        const q = sec.questions[qi];
        const qNum = qi + 1;

        // Estimate height needed for this question
        const estimatedH = 8 + q.options.length * 4 + (q.languageQuestions?.length || 0) * 4;
        curY = checkPageBreak(doc, curY, Math.min(estimatedH, 25), pageNum, assessmentName);

        // Question number + text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
        doc.text(`Q${qNum}.`, MARGIN + 2, curY + 3);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
        const qLines = wrapText(doc, q.questionText, CONTENT_W - 15);
        for (let li = 0; li < qLines.length; li++) {
          curY = checkPageBreak(doc, curY, 4, pageNum, assessmentName);
          doc.text(qLines[li], MARGIN + 12, curY + 3);
          if (li < qLines.length - 1) curY += 4;
        }
        curY += 5;

        // Language translations for question
        if (q.languageQuestions && q.languageQuestions.length > 0) {
          for (const lq of q.languageQuestions) {
            if (lq.QuestionText) {
              curY = checkPageBreak(doc, curY, 5, pageNum, assessmentName);
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(100, 100, 100);
              const langLines = wrapText(doc, `(${lq.language?.languageName || ""}) ${lq.QuestionText}`, CONTENT_W - 18);
              for (const line of langLines) {
                doc.text(line, MARGIN + 12, curY);
                curY += 3.5;
              }
            }
          }
        }

        // Options inline (A, B, C, D style)
        if (q.options.length <= 6) {
          // Horizontal layout for few options
          curY = checkPageBreak(doc, curY, 6, pageNum, assessmentName);
          const optSpacing = Math.min(CONTENT_W / q.options.length, 45);
          for (let oi = 0; oi < q.options.length; oi++) {
            const opt = q.options[oi];
            const ox = MARGIN + 12 + oi * optSpacing;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
            doc.text(`${OPT_LABELS[oi]}.`, ox, curY + 2);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
            const optText = opt.optionText.length > 20
              ? opt.optionText.substring(0, 18) + "..."
              : opt.optionText;
            doc.text(optText, ox + 5, curY + 2);
          }

          // Language translations for options on next line
          if (q.languageQuestions && q.languageQuestions.length > 0) {
            for (const lq of q.languageQuestions) {
              if (lq.options && lq.options.length > 0) {
                curY += 4;
                curY = checkPageBreak(doc, curY, 5, pageNum, assessmentName);
                for (let oi = 0; oi < q.options.length; oi++) {
                  const langOpt = lq.options?.find(
                    (lo: LanguageOption) => lo.assessmentOption?.optionId === q.options[oi].optionId
                  );
                  if (langOpt?.LanguageoptionText) {
                    const ox = MARGIN + 12 + oi * optSpacing;
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(6);
                    doc.setTextColor(120, 120, 120);
                    const langOptText = langOpt.LanguageoptionText.length > 20
                      ? langOpt.LanguageoptionText.substring(0, 18) + "..."
                      : langOpt.LanguageoptionText;
                    doc.text(`${OPT_LABELS[oi]}. ${langOptText}`, ox, curY + 2);
                  }
                }
              }
            }
          }

          curY += 5;
        } else {
          // Vertical layout for many options
          for (let oi = 0; oi < q.options.length; oi++) {
            curY = checkPageBreak(doc, curY, 5, pageNum, assessmentName);
            const opt = q.options[oi];

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
            doc.text(`${OPT_LABELS[oi]}.`, MARGIN + 14, curY + 2);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(TEXT_R, TEXT_G, TEXT_B);
            doc.text(opt.optionText, MARGIN + 20, curY + 2);
            curY += 4;
          }
        }

        // Separator line between questions
        if (qi < sec.questions.length - 1) {
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.1);
          doc.line(MARGIN + 5, curY, PAGE_W - MARGIN - 5, curY);
          curY += 3;
        }
      }
    }

    curY += 6;
  }

  // Final page footer
  addPageFooter(doc, pageNum.val, assessmentName);

  /* 4. Save */
  const sanitizedName = assessmentName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Questionnaire_${sanitizedName}.pdf`);
}
