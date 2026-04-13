// Build 4 .docx files (OOXML) via PowerShell Compress-Archive.
// Usage: node docs/build_docs.mjs
import { writeFileSync, mkdirSync, rmSync, existsSync, renameSync } from "fs";
import { execSync } from "child_process";
import { join, resolve } from "path";

const ROOT = resolve(process.cwd(), "docs");
const TMP = join(ROOT, ".tmp_docx");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Content model helpers --------------------------------------------------
const H1 = (text) => ({ type: "h1", text });
const H2 = (text) => ({ type: "h2", text });
const H3 = (text) => ({ type: "h3", text });
const P = (text) => ({ type: "p", text });
const BULLET = (text) => ({ type: "bullet", text });
const NUM = (text) => ({ type: "num", text });
const SHOT = (text) => ({ type: "shot", text });
const NOTE = (text) => ({ type: "note", text });
const CODE = (text) => ({ type: "code", text });

// OOXML paragraph builders ----------------------------------------------
const runStyle = ({ bold = false, italic = false, size = 22, color = "222222", font = "Calibri" } = {}) => `
  <w:rPr>
    ${bold ? "<w:b/>" : ""}
    ${italic ? "<w:i/>" : ""}
    <w:color w:val="${color}"/>
    <w:sz w:val="${size}"/>
    <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>
  </w:rPr>`;

const run = (text, opts = {}) =>
  `<w:r>${runStyle(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

const para = (runsXml, { spacingAfter = 120, align, indent = 0, border = false, shade } = {}) => `
  <w:p>
    <w:pPr>
      ${align ? `<w:jc w:val="${align}"/>` : ""}
      ${indent ? `<w:ind w:left="${indent}"/>` : ""}
      <w:spacing w:after="${spacingAfter}"/>
      ${
        border
          ? `<w:pBdr>
              <w:top w:val="single" w:sz="8" w:space="4" w:color="4361EE"/>
              <w:left w:val="single" w:sz="8" w:space="4" w:color="4361EE"/>
              <w:bottom w:val="single" w:sz="8" w:space="4" w:color="4361EE"/>
              <w:right w:val="single" w:sz="8" w:space="4" w:color="4361EE"/>
            </w:pBdr>`
          : ""
      }
      ${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ""}
    </w:pPr>
    ${runsXml}
  </w:p>`;

const blockToXml = (b) => {
  switch (b.type) {
    case "h1":
      return para(run(b.text, { bold: true, size: 40, color: "1A1A2E" }), { spacingAfter: 220 });
    case "h2":
      return para(run(b.text, { bold: true, size: 30, color: "4361EE" }), { spacingAfter: 160 });
    case "h3":
      return para(run(b.text, { bold: true, size: 26, color: "1A1A2E" }), { spacingAfter: 120 });
    case "p":
      return para(run(b.text), { spacingAfter: 140 });
    case "bullet":
      return para(run("•  " + b.text), { indent: 360, spacingAfter: 80 });
    case "num":
      // numbering handled by leading "N. " in text for simplicity
      return para(run(b.text), { indent: 360, spacingAfter: 100 });
    case "shot":
      return para(
        run("[ SCREENSHOT PLACEHOLDER ] ", { bold: true, color: "B91C1C" }) +
          run(b.text, { italic: true, color: "374151" }),
        { border: true, shade: "FEF2F2", spacingAfter: 180 }
      );
    case "note":
      return para(
        run("Note: ", { bold: true, color: "047857" }) + run(b.text, { color: "065F46" }),
        { shade: "ECFDF5", spacingAfter: 160 }
      );
    case "code":
      return para(run(b.text, { font: "Consolas", size: 20, color: "1F2937" }), {
        shade: "F3F4F6",
        spacingAfter: 140,
      });
    default:
      return "";
  }
};

const buildDocumentXml = (blocks) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${blocks.map(blockToXml).join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

// Zip via PowerShell Compress-Archive, then rename .zip -> .docx
const writeDocx = (name, blocks) => {
  const workDir = join(TMP, name);
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
  mkdirSync(join(workDir, "_rels"), { recursive: true });
  mkdirSync(join(workDir, "word"), { recursive: true });

  writeFileSync(join(workDir, "[Content_Types].xml"), CONTENT_TYPES);
  writeFileSync(join(workDir, "_rels", ".rels"), ROOT_RELS);
  writeFileSync(join(workDir, "word", "document.xml"), buildDocumentXml(blocks));

  const zipPath = join(ROOT, name + ".zip");
  const docxPath = join(ROOT, name + ".docx");
  if (existsSync(zipPath)) rmSync(zipPath);
  if (existsSync(docxPath)) rmSync(docxPath);

  // PowerShell Compress-Archive: wildcard includes dotfiles at top level.
  const psCmd = `Compress-Archive -Path '${workDir}\\*' -DestinationPath '${zipPath}' -Force`;
  execSync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
  renameSync(zipPath, docxPath);
  console.log("Wrote", docxPath);
};

// =======================================================================
// DOCUMENT 1 — How to create an Assessment
// =======================================================================
const doc1 = [
  H1("How to Create an Assessment"),
  P(
    "This guide walks through the full assessment-creation flow in Career-Nine: creating a section, adding questions to it, building a questionnaire, and finally creating the assessment that students take."
  ),
  NOTE(
    "The four steps must be done in order. A questionnaire needs sections and questions to exist first, and an assessment wraps a questionnaire."
  ),

  H2("Step 1 — Create a Section"),
  P(
    "Sections group related questions inside a questionnaire (e.g. 'Aptitude', 'Interest', 'Personality'). Every question belongs to exactly one section."
  ),
  H3("Navigation"),
  NUM("1. Open the left-hand menu and click Question Sections."),
  NUM("2. Click the Create Section button in the top-right."),
  NUM("3. The Add Section page opens at /question-sections/create."),
  SHOT("Question Sections list page showing the Create Section button in the top-right."),
  H3("Fill the form"),
  BULLET("Section Name — short label, required (e.g. 'Numerical Aptitude')."),
  BULLET("Section Description — one-line description, required."),
  NUM("4. Click Submit. You will be redirected back to /question-sections and the new section appears in the table."),
  SHOT("Add Section form filled with Section Name and Section Description."),

  H2("Step 2 — Create Questions"),
  P(
    "Once the section exists, add questions to it. Each question has options, and each option can carry scores against one or more Measured Quality Types (MQTs)."
  ),
  H3("Navigation"),
  NUM("1. Open Assessment Questions from the menu."),
  NUM("2. Click Create Question (or use Bulk Upload for Excel imports — see below)."),
  NUM("3. The Create Question page opens at /assessment-questions/create."),
  SHOT("Assessment Questions table with Create Question and Bulk Upload buttons."),
  H3("Fill the form"),
  BULLET("Question Text — the actual question shown to students."),
  BULLET("Question Type — e.g. single choice, multiple choice."),
  BULLET("Section — select the section created in Step 1."),
  BULLET("Max Options Allowed — how many options a student may select."),
  BULLET("Options — add at least two. For each option, optionally attach MQT scores (e.g. Analytical:10, Creativity:5)."),
  NUM("4. Click Save. The question appears in the Assessment Questions table."),
  SHOT("Create Question form showing question text, section dropdown, options list, and MQT score inputs on each option."),
  H3("Bulk upload (optional)"),
  P(
    "For large question banks, click Bulk Upload on the Assessment Questions page to open the upload modal."
  ),
  NUM("1. Click Download Template to get an Excel file with the expected columns."),
  NUM("2. Fill one row per question: Question Text, Question Type, Section ID, Max Options Allowed, Option 1–6 (Text, Description, Is Correct, MQTs)."),
  NUM("3. Upload the file. The modal parses it and shows a preview — use Next/Previous to walk through each parsed question, edit if needed, then click Submit."),
  NOTE(
    "MQT format inside the Excel cell is 'Name:Score,Name:Score' — e.g. 'Analytical:10,Creativity:5'. Images are not supported in the Excel import; add them manually afterwards."
  ),
  SHOT("Bulk Upload modal in preview state showing question 1 of N with editable fields and Next/Previous buttons."),

  H2("Step 3 — Create a Questionnaire"),
  P(
    "A questionnaire binds sections and questions together into a structured ordered flow with optional multi-language support."
  ),
  H3("Navigation"),
  NUM("1. Open Questionnaires from the menu."),
  NUM("2. Click Create Questionnaire."),
  SHOT("Questionnaire list page with Create Questionnaire button."),
  H3("Fill the form"),
  BULLET("Questionnaire Name and Description."),
  BULLET("Add one or more sections (from Step 1). For each section, pick the questions (from Step 2) to include and their order."),
  BULLET("Optionally add supported languages for translations."),
  NUM("3. Click Save — the questionnaire is now reusable across multiple assessments."),
  SHOT("Questionnaire builder showing section list on the left and questions being added into each section on the right."),

  H2("Step 4 — Create the Assessment"),
  P(
    "The assessment is what a student actually launches. It wraps a questionnaire and adds run-time settings (timing, visibility, pricing, tools, reports)."
  ),
  H3("Navigation"),
  NUM("1. Open Assessments from the menu."),
  NUM("2. Click the green Create Assessment button in the top-right. You land on /assessments/create."),
  SHOT("Assessments list page with the Create Assessment button highlighted in the header."),
  H3("Wizard steps"),
  P(
    "The create-assessment flow is a multi-step wizard. Each step is its own URL — you can go back with the browser back button or the wizard's Previous button."
  ),
  BULLET("/assessments/create — basic details (name, description, questionnaire selection)."),
  BULLET("/assessments/create/step-2 — scoring / measured quality setup."),
  BULLET("/assessments/create/step-3 — tools and report configuration."),
  BULLET("/assessments/create/step-4 — preview / validation."),
  BULLET("/assessments/create/step-5 — final review and publish."),
  SHOT("Assessment wizard step 1 showing name, description, and questionnaire dropdown."),
  SHOT("Assessment wizard final step with Publish/Save button and a summary of the assessment."),
  H3("After creation"),
  P(
    "The new assessment appears in the Assessments table. Use Assessment Mapping (see the Institute guide) to make it available to specific students, classes, or sessions in an institute."
  ),
  NOTE(
    "Assessments are inactive until mapped. Creating one does not automatically assign it to any students."
  ),
];

// =======================================================================
// DOCUMENT 2 — How to create an Institute
// =======================================================================
const doc2 = [
  H1("How to Create an Institute"),
  P(
    "An institute (school or college) in Career-Nine holds a hierarchy of sessions → grades/classes → sections, and is the scope under which students enroll and take assessments. This guide covers creating the institute, adding its academic structure, and mapping assessments to it."
  ),

  H2("Step 1 — Create the Institute"),
  H3("Navigation"),
  NUM("1. Open Institutes (Colleges) from the left menu."),
  NUM("2. Click the Create Institute button in the top-right of the Institutes table."),
  SHOT("Institutes list page with the Create Institute button visible."),
  H3("Fill the Create Institute modal"),
  BULLET("Institute Name — required. Display name shown across the app."),
  BULLET("Institute Address — required."),
  BULLET("Institute Code — required, unique identifier. Used as the foreign key everywhere."),
  BULLET("Maximum Students — required. Upper cap on the number of enrolled students."),
  BULLET("Maximum Contact Persons — required. Cap on assigned contact persons/counsellors."),
  BULLET("Logo — optional image upload. Max size 1 MB. Stored as base64 on the institute record."),
  NUM("3. Click Save. The modal closes and the new institute appears in the table."),
  SHOT("Create Institute modal with all fields filled and logo preview visible."),
  NOTE(
    "Institute Code must be unique. If you pick a value that already exists, the backend rejects the save."
  ),

  H2("Step 2 — Add Sessions, Grades and Sections"),
  P(
    "A fresh institute has no academic structure. You now add one or more sessions (e.g. '2025-26'), add grades/classes inside each session, and add sections inside each grade."
  ),
  H3("Open the structure editor"),
  NUM("1. In the Institutes table, find the row for the institute you just created."),
  NUM("2. Click the row's action menu and choose Manage Sessions / Grades / Sections."),
  NUM("3. The Session–Grade–Section modal opens. Existing data (if any) loads from the backend for this institute code."),
  SHOT("Institute row action menu open with the 'Manage Sessions / Grades / Sections' option highlighted."),
  H3("Add a session"),
  NUM("1. In the Session dropdown area, type a session name (e.g. '2025-26') and click Add."),
  NUM("2. The new session appears below. Select it — it becomes the 'current session' for adding grades."),
  H3("Add a grade"),
  NUM("3. With a session selected, type a grade name (e.g. '10', '11', 'FY BSc') and click Add."),
  NUM("4. Select the grade to make it the current grade for adding sections."),
  H3("Add a section"),
  NUM("5. With a grade selected, type a section name (e.g. 'A', 'B', 'Commerce-1') and click Add."),
  NUM("6. Repeat as needed. Existing entries can be edited or deleted from the same panel (pencil / trash icons)."),
  NUM("7. When done, click Save. All new sessions, grades, and sections are persisted in one call."),
  SHOT("Session–Grade–Section modal showing a session expanded with grades and sections beneath it."),
  NOTE(
    "Editing or deleting an existing grade/section affects students already mapped to it — check usage before deleting anything created in a prior term."
  ),

  H2("Step 3 — Assessment Mapping"),
  P(
    "Mapping attaches an assessment to the institute at one of three scopes: an entire session, a specific class (grade) within a session, or a specific section within a class."
  ),
  H3("Open the mapping modal"),
  NUM("1. In the Institutes table, open the row action menu for your institute."),
  NUM("2. Click Assessment Mapping. The modal loads the institute's sessions, the list of active assessments, and any existing mappings."),
  SHOT("Assessment Mapping modal, fresh open state, showing Assessment dropdown and mapping level selector."),
  H3("Create a mapping"),
  NUM("1. Pick an Assessment from the dropdown."),
  NUM("2. Pick a Mapping Level:"),
  BULLET("SESSION — the assessment is available to every student in the chosen session."),
  BULLET("CLASS — restricted to a specific class within a session."),
  BULLET("SECTION — restricted to a single section within a class."),
  NUM("3. Based on the level, pick Session → then Class → then Section as applicable."),
  NUM("4. Optionally set an Amount (for paid assessments)."),
  NUM("5. Click Create Mapping."),
  SHOT("Assessment Mapping modal with level set to CLASS and session + class selected."),
  H3("Share links with students"),
  P(
    "Once a mapping exists, the modal shows the generated assessment link and a QR code. Students can open the link or scan the QR to launch the assessment."
  ),
  BULLET("Click the copy icon next to a mapping to copy its link to the clipboard."),
  BULLET("Click the QR icon to preview the QR code, and Download to save it as an image."),
  BULLET("Click the trash icon on an existing mapping to remove it."),
  SHOT("Assessment Mapping modal showing an existing mapping row with Copy, QR, Download, and Delete actions."),
  NOTE(
    "Only assessments with isActive != false show up in the dropdown. Inactive or archived assessments are filtered out."
  ),
];

// =======================================================================
// DOCUMENT 3 — Bulk student upload
// =======================================================================
const doc3 = [
  H1("How to Upload Students in Bulk"),
  P(
    "Career-Nine supports bulk student creation via Excel/CSV, scoped to an institute. This avoids entering each student one-by-one through the Create Student modal."
  ),
  NOTE(
    "Before uploading, the target institute must exist and must have at least one session, grade, and section configured (see the 'Create an Institute' guide, Step 2)."
  ),

  H2("Step 1 — Prepare the Spreadsheet"),
  P("Create an Excel (.xlsx / .xls) or CSV file with one row per student. The first row must contain column headers."),
  H3("Required / recommended columns"),
  BULLET("name — full name of the student."),
  BULLET("email — student email address."),
  BULLET("rollNo (or schoolRollNumber) — institute-side roll number."),
  BULLET("phoneNumber — optional contact number."),
  BULLET("dob — date of birth (DD-MM-YYYY recommended)."),
  BULLET("session / class / section — names must match the ones you created for the institute."),
  NOTE(
    "Column names are case-sensitive. If the upload silently skips rows, open the uploaded file and verify headers match what the backend expects."
  ),
  SHOT("Sample students.xlsx opened in Excel showing header row and 3–5 example student rows."),

  H2("Step 2 — Open the Upload Dialog"),
  NUM("1. Open Institutes from the left menu."),
  NUM("2. Find the target institute in the table."),
  NUM("3. Open the row action menu and click Upload Students."),
  NUM("4. The Upload Students modal opens and displays the institute name at the top so you can confirm the target."),
  SHOT("Institute row action menu with 'Upload Students' highlighted."),
  SHOT("Upload Students modal showing the institute name and the file picker."),

  H2("Step 3 — Upload the File"),
  NUM("1. Click Choose File and select the prepared .xlsx / .xls / .csv file."),
  NUM("2. Confirm the correct file appears in the picker."),
  NUM("3. Click Upload."),
  NUM("4. Wait for the success message. The modal reports row-level results when available."),
  SHOT("Upload Students modal with a file selected and the 'Uploaded successfully' confirmation."),

  H2("Step 4 — Verify the Results"),
  NUM("1. Close the upload modal."),
  NUM("2. Open Student Information (or the institute's student list) from the menu."),
  NUM("3. Filter by institute / session / class / section and confirm the newly uploaded students are present with the expected fields."),
  SHOT("Student Information list filtered to the target institute showing the newly imported students."),
  H3("Common issues"),
  BULLET("Session/Class/Section name mismatch — rows are rejected because the hierarchy lookup fails. Fix the spreadsheet or add the missing entries in the institute structure editor."),
  BULLET("Duplicate email or roll number — the backend enforces uniqueness; duplicates fail while valid rows still succeed."),
  BULLET("Date format — prefer DD-MM-YYYY. ISO (YYYY-MM-DD) is also accepted by most fields but mixing formats in the same column causes parse errors."),
  BULLET("File too large — split into multiple files (e.g. 500 rows each) if the upload times out."),
  NOTE(
    "Students uploaded in bulk are not auto-assigned to any assessment. Use Assessment Mapping on the institute to make assessments available to them, or assign them per-student from the Student Information page."
  ),
];

// =======================================================================
// DOCUMENT 4 — Generate reports from Reports Hub
// =======================================================================
const doc4 = [
  H1("How to Generate Reports from the Reports Hub"),
  P(
    "The Reports Hub is the one-stop page to generate, preview, download, release, and send student reports for a given assessment. It lives at /reports-hub in the app."
  ),

  H2("Step 1 — Select Institute and Assessment"),
  NUM("1. Open Reports Hub from the left menu."),
  NUM("2. At the top of the page, select a School / Institute from the first dropdown."),
  NUM("3. The Assessment dropdown becomes enabled and is filtered to assessments mapped to that institute. Select an assessment."),
  NUM("4. The page loads the student list and existing report data for that combination."),
  SHOT("Reports Hub header with School/Institute and Assessment dropdowns both filled."),
  NOTE(
    "If the Assessment dropdown is empty, there is no Assessment Mapping for this institute yet. Create one from the Institutes page first."
  ),

  H2("Step 2 — Filter the Student List"),
  P("Once a student list loads, use the filter bar to narrow down who you are generating for."),
  BULLET("Search — by name, roll number, email, or DOB."),
  BULLET("Grade / Class — dropdown of grades present on this institute."),
  BULLET("Section — dropdown of sections present on this institute."),
  BULLET("Pagination — bottom of the table; adjust page size for large cohorts."),
  SHOT("Reports Hub student table with Search, Grade, and Section filters applied."),

  H2("Step 3 — Select Students"),
  P("Reports Hub operates in two modes: all displayed students, or an explicit selection."),
  BULLET("Header checkbox — select/deselect every student on the current page."),
  BULLET("Row checkbox — select an individual student."),
  BULLET("The action button count label shows '(N)' when students are selected, or '(All X)' when nothing is explicitly picked."),
  SHOT("Student table with several rows selected, showing the count label next to the Generate button."),

  H2("Step 4 — Generate Reports"),
  NUM("1. Click the Generate button (green gradient)."),
  NUM("2. A progress bar appears below the action bar showing the current step and processed-count."),
  NUM("3. When generation finishes, each processed student's Report column flips from 'Not Generated' to 'Generated'."),
  SHOT("Reports Hub with the Generate progress bar mid-run."),
  NOTE(
    "Generation is incremental — re-running it only processes students whose reports are missing or have been invalidated."
  ),

  H2("Step 5 — Preview and Download"),
  H3("Per-student"),
  BULLET("Preview — opens the report in a new tab."),
  BULLET("Download — downloads a PDF named '{student}_Career_Navigator.pdf' (or '{student}_BET_Report.pdf' for BET assessments)."),
  BULLET("Nav 360 — where available, opens the Navigator 360 preview for the student."),
  SHOT("Single row in the Reports Hub table with Preview, Download, and Nav 360 buttons visible."),
  H3("Bulk download (ZIP)"),
  NUM("1. Click Download ZIP. You will be prompted for a zip name."),
  NUM("2. The ZIP job starts in the background. Click Downloads to open the Downloads Manager modal."),
  NUM("3. The Downloads Manager shows progress, lets you delete old jobs, and provides a final download link when the job completes."),
  SHOT("Downloads Manager modal listing one in-progress ZIP job and one completed job with a Download link."),

  H2("Step 6 — Release or Hide Reports"),
  P(
    "Reports are hidden from students by default after generation. You must explicitly release them."
  ),
  BULLET("Release — flips the Visible toggle ON for the selected (or all displayed) students. They can now see their own report in the student portal."),
  BULLET("Hide — flips the toggle OFF. Use this if a report needs correction or should be pulled back."),
  BULLET("Per-row toggle — the Visible column has a switch to release/hide a single student without touching the bulk action."),
  SHOT("Reports Hub action bar with the Release and Hide buttons, plus per-row Visible toggles in the table."),

  H2("Step 7 — Send Reports to Students"),
  H3("Bulk Send"),
  NUM("1. Click Bulk Send (pink gradient)."),
  NUM("2. The Bulk Send modal opens. Choose the delivery channel (email / WhatsApp) and confirm the recipient list."),
  NUM("3. Click Send. The modal reports per-recipient success and failure counts."),
  SHOT("Bulk Send modal showing channel selection and a preview of the recipient list."),
  H3("Email Compose"),
  P(
    "From the compose flow you can customize the subject and body. Template variables {{student_name}} and {{report_link}} are replaced per-student automatically."
  ),
  SHOT("Email Compose modal with subject/body fields and template variables visible."),
  H3("WhatsApp"),
  P(
    "Bulk WhatsApp uses a pre-approved template ('report_notification') with parameters [student name, assessment name, report URL]. Only students with a saved phone number and a generated report are included."
  ),

  H2("Additional Actions"),
  BULLET("Mira Desai — opens the Mira Desai modal for that assessment (special report variant)."),
  BULLET("Nav 360 Preview — per-row button, only shown when the student's assessment status is 'completed'."),
  BULLET("School Report — opens the school-level (aggregated) report modal."),

  H2("Status Reference"),
  H3("Assessment status badges"),
  BULLET("notstarted — student has not opened the assessment yet (yellow)."),
  BULLET("ongoing — student has started but not submitted (blue)."),
  BULLET("completed — submitted; eligible for report generation (green)."),
  H3("Report status badges"),
  BULLET("Not Generated — no report file exists yet (yellow)."),
  BULLET("Generated — report file exists and is ready to preview/download/release (green)."),
  NOTE(
    "A student with status 'ongoing' or 'notstarted' can still have Generate clicked on their row, but the backend will skip them — only 'completed' students produce a report."
  ),
];

// =======================================================================
// Build all four
// =======================================================================
mkdirSync(TMP, { recursive: true });
writeDocx("1_How_to_Create_Assessment", doc1);
writeDocx("2_How_to_Create_Institute", doc2);
writeDocx("3_How_to_Upload_Students_Bulk", doc3);
writeDocx("4_How_to_Generate_Reports_From_Reports_Hub", doc4);
rmSync(TMP, { recursive: true, force: true });
console.log("\nAll 4 docs written to docs/");
