import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import { downloadReportAsPdf, htmlToPdfBlob } from "../ReportGeneration/utils/htmlToPdf";
import JSZip from "jszip";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
import {
  getStudentsWithMappingByInstituteId,
  getAllAssessments,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";
import { getAssessmentMappingsByInstitute } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import {
  getReportType,
  generateDataForAssessment,
  getReportDataByAssessment,
  generateReportsForAssessment,
  downloadReport,
  getReportUrls,
  ReportType,
} from "../UnifiedReportManagement/API/UnifiedReport_APIs";
import {
  createOrUpdateGeneratedReport,
  getGeneratedReportsByAssessment,
  toggleReportVisibility,
} from "../ReportGeneration/API/GeneratedReport_APIs";
import { generateAndExportNavigatorExcel } from "../NavigatorReportGeneration/API/NavigatorReportData_APIs";
import { exportMqtScoresExcel } from "../ReportGeneration/API/BetReportData_APIs";
import {
  SendReportEmail,
  SendWhatsApp,
  SendWhatsAppBulk,
} from "../ContactPerson/API/Contact_Person_APIs";
import SchoolReportModal from "../Reports/SchoolReportModal";
import MiraDesaiModal from "./components/MiraDesaiModal";
import BulkSendModal from "./components/BulkSendModal";
import EmailComposeModal from "./components/EmailComposeModal";
import DownloadsModal, { ZipJob } from "./components/DownloadsModal";
import { uploadReportZip, deleteReportZip } from "./API/ReportZip_APIs";
import { Navigator360Preview } from "./navigator360/Navigator360Report";

// ═══════════════════════ TYPES ═══════════════════════

type StudentRow = {
  userStudentId: number;
  name: string;
  username?: string;
  email?: string;
  schoolRollNumber?: string;
  controlNumber?: number;
  phoneNumber?: string;
  studentDob?: string;
  schoolSectionId?: number;
  assessments?: { assessmentId: number; assessmentName: string; status: string }[];
  assignedAssessmentIds?: number[];
};

type SectionInfo = { className: string; sectionName: string };

type ReportData = {
  userStudent?: { userStudentId: number };
  reportStatus: string;
  reportUrl?: string | null;
  eligible?: boolean;
  [key: string]: any;
};

// ═══════════════════════ COMPONENT ═══════════════════════

const ReportsHubPage: React.FC = () => {
  // ── Institute ──
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [institutesLoading, setInstitutesLoading] = useState(false);

  // ── Assessment (URM approach: filtered by institute mapping) ──
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [mappedAssessmentIds, setMappedAssessmentIds] = useState<Set<number> | null>(null);

  // ── Students ──
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Report data ──
  const [reportDataMap, setReportDataMap] = useState<Map<number, ReportData>>(new Map());
  const [reportDataLoading, setReportDataLoading] = useState(false);

  // ── Visibility ──
  const [visibilityMap, setVisibilityMap] = useState<Map<number, { id: number; visible: boolean }>>(new Map());
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  // ── Selection + pagination ──
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Search + Filters ──
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "completed" | "ongoing" | "notstarted">("");

  // ── Action states ──
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [exportingMQT, setExportingMQT] = useState(false);
  const [exportingDataExcel, setExportingDataExcel] = useState(false);
  // downloadingZip / zipProgress removed — replaced by zipJobs

  // ── ZIP jobs (persisted across re-renders via ref+state) ──
  const [zipJobs, setZipJobs] = useState<ZipJob[]>([]);
  const zipJobsRef = useRef<ZipJob[]>(zipJobs);
  zipJobsRef.current = zipJobs;
  const [deletingJobs, setDeletingJobs] = useState<Set<string>>(new Set());

  // ── Modals ──
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [zipNamePromptOpen, setZipNamePromptOpen] = useState(false);
  const [zipNameInput, setZipNameInput] = useState("");
  const pendingZipIds = useRef<number[]>([]);
  const [miraDesaiOpen, setMiraDesaiOpen] = useState(false);
  const [schoolReportOpen, setSchoolReportOpen] = useState(false);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeStudentIds, setComposeStudentIds] = useState<number[]>([]);
  const [composeRecipients, setComposeRecipients] = useState<{ email: string; name: string }[]>([]);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // ── Per-row states ──
  const [sendingWhatsApp, setSendingWhatsApp] = useState<Set<number>>(new Set());
  const [downloadingStudentId, setDownloadingStudentId] = useState<number | null>(null);

  // ── Navigator 360 preview ──
  const [nav360Preview, setNav360Preview] = useState<{ studentId: number; studentName: string } | null>(null);

  // ═══════════════════════ DATA LOADING ═══════════════════════

  useEffect(() => {
    setInstitutesLoading(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setInstitutesLoading(false));
    getAllAssessments()
      .then((res) => setAllAssessments(res.data || []))
      .catch(() => setAllAssessments([]));
  }, []);

  // Load assessment mappings for selected institute (URM approach)
  useEffect(() => {
    if (selectedInstitute === "") { setMappedAssessmentIds(null); return; }
    setAssessmentsLoading(true);
    getAssessmentMappingsByInstitute(Number(selectedInstitute))
      .then((res) => {
        const ids = new Set<number>(
          (res.data || []).filter((m: any) => m.isActive !== false).map((m: any) => Number(m.assessmentId))
        );
        setMappedAssessmentIds(ids.size > 0 ? ids : null);
      })
      .catch(() => setMappedAssessmentIds(null))
      .finally(() => setAssessmentsLoading(false));
  }, [selectedInstitute]);

  // Filter assessments by institute mapping
  useEffect(() => {
    if (mappedAssessmentIds && mappedAssessmentIds.size > 0) {
      setAssessments(allAssessments.filter((a) => mappedAssessmentIds.has(a.id)));
    } else {
      setAssessments(allAssessments);
    }
  }, [allAssessments, mappedAssessmentIds]);

  // Load students + sections when institute changes
  useEffect(() => {
    if (selectedInstitute === "") { setStudents([]); setSectionLookup(new Map()); return; }
    setStudentsLoading(true);
    Promise.all([
      getStudentsWithMappingByInstituteId(Number(selectedInstitute)),
      GetSessionsByInstituteCode(selectedInstitute),
    ])
      .then(([studentsRes, sessionsRes]) => {
        setStudents(studentsRes.data || []);
        const lookup = new Map<number, SectionInfo>();
        for (const session of sessionsRes.data || []) {
          for (const cls of session.schoolClasses || []) {
            for (const sec of cls.schoolSections || []) {
              if (!lookup.has(sec.id)) lookup.set(sec.id, { className: cls.className, sectionName: sec.sectionName });
            }
          }
        }
        setSectionLookup(lookup);
      })
      .catch(() => { setStudents([]); setSectionLookup(new Map()); })
      .finally(() => setStudentsLoading(false));
  }, [selectedInstitute]);

  // Reset on selection change
  useEffect(() => { setSelectedAssessment(""); }, [selectedInstitute]);
  useEffect(() => {
    setSelectedStudentIds(new Set());
    setCurrentPage(1);
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setReportDataMap(new Map());
    setVisibilityMap(new Map());
  }, [selectedInstitute, selectedAssessment]);

  // Load report data + visibility when assessment selected
  const selectedAssessmentObj = useMemo(() => {
    if (selectedAssessment === "") return null;
    return assessments.find((a) => a.id === Number(selectedAssessment)) || null;
  }, [assessments, selectedAssessment]);

  const reportType: ReportType = selectedAssessmentObj ? getReportType(selectedAssessmentObj) : "bet";
  const isBet = reportType === "bet";
  const isNavigator = !isBet;

  const refreshReportData = useCallback(async (): Promise<Map<number, ReportData>> => {
    if (!selectedAssessmentObj) return new Map();
    setReportDataLoading(true);
    try {
      const res = await getReportDataByAssessment(selectedAssessmentObj);
      const map = new Map<number, ReportData>();
      for (const r of res.data || []) {
        const id = r.userStudent?.userStudentId;
        if (id) map.set(id, r);
      }
      setReportDataMap(map);
      return map;
    } catch {
      setReportDataMap(new Map());
      return new Map();
    } finally {
      setReportDataLoading(false);
    }
  }, [selectedAssessmentObj]);

  const refreshVisibility = useCallback(async () => {
    if (!selectedAssessmentObj) return;
    try {
      const res = await getGeneratedReportsByAssessment(selectedAssessmentObj.id);
      const map = new Map<number, { id: number; visible: boolean }>();
      for (const gr of res.data || []) {
        if (gr.typeOfReport === reportType) {
          map.set(gr.userStudent.userStudentId, {
            id: gr.generatedReportId,
            visible: gr.visibleToStudent ?? false,
          });
        }
      }
      setVisibilityMap(map);
    } catch {
      setVisibilityMap(new Map());
    }
  }, [selectedAssessmentObj, reportType]);

  useEffect(() => { if (selectedAssessmentObj) { refreshReportData(); refreshVisibility(); } }, [selectedAssessmentObj, refreshReportData, refreshVisibility]);

  // ═══════════════════════ FILTERING ═══════════════════════

  const assessmentStudents = useMemo(() => {
    if (!selectedAssessmentObj) return [];
    return students.filter((s) => (s.assignedAssessmentIds || []).includes(selectedAssessmentObj.id));
  }, [students, selectedAssessmentObj]);

  const uniqueGrades = useMemo(() => {
    const g = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.className) g.add(info.className);
    }
    return Array.from(g).sort();
  }, [assessmentStudents, sectionLookup]);

  const uniqueSections = useMemo(() => {
    const sec = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.sectionName) sec.add(info.sectionName);
    }
    return Array.from(sec).sort();
  }, [assessmentStudents, sectionLookup]);

  const displayedStudents = useMemo(() => {
    let result = assessmentStudents;
    if (nameQuery.trim()) {
      const q = nameQuery.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.username || "").toLowerCase().includes(q) ||
        (s.schoolRollNumber || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.studentDob || "").includes(q)
      );
    }
    if (selectedGrade) result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.className === selectedGrade);
    if (selectedSection) result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.sectionName === selectedSection);
    if (selectedStatus && selectedAssessmentObj) {
      result = result.filter((s) => {
        const st = (s.assessments || []).find((a: any) => a.assessmentId === selectedAssessmentObj.id)?.status || "notstarted";
        return st === selectedStatus;
      });
    }
    return result;
  }, [assessmentStudents, nameQuery, selectedGrade, selectedSection, selectedStatus, selectedAssessmentObj, sectionLookup]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(
    () => displayedStudents.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize),
    [displayedStudents, safeCurrentPage, pageSize]
  );

  useEffect(() => { setCurrentPage(1); }, [nameQuery, selectedGrade, selectedSection, selectedStatus]);

  // ═══════════════════════ HELPERS ═══════════════════════

  const getSelectedOrAllIds = () => {
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    const sel = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
    return sel.length > 0 ? sel : displayedStudents.map((s) => s.userStudentId);
  };

  const visibleSelectedCount = useMemo(() => {
    const vis = new Set(displayedStudents.map((s) => s.userStudentId));
    return Array.from(selectedStudentIds).filter((id) => vis.has(id)).length;
  }, [selectedStudentIds, displayedStudents]);

  const reportStats = useMemo(() => {
    let generated = 0, notGenerated = 0;
    for (const s of displayedStudents) {
      const rd = reportDataMap.get(s.userStudentId);
      if (rd && rd.reportStatus === "generated") generated++;
      else notGenerated++;
    }
    return { generated, notGenerated };
  }, [displayedStudents, reportDataMap]);

  const downloadBlob = (data: any, filename: string) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
  };

  const selectedInstituteName = institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";
  const selectedAssessmentName = selectedAssessmentObj?.assessmentName || "";
  const ready = selectedInstitute !== "" && selectedAssessment !== "";
  const accentColor = isBet ? "#4361ee" : "#0d9488";

  // ═══════════════════════ GENERATE ALL (data + reports) ═══════════════════════

  const handleGenerate = async () => {
    if (!selectedAssessmentObj) return;
    let ids = getSelectedOrAllIds();
    if (ids.length === 0) return;
    setGenerating(true);
    setGenerateProgress({ step: "Generating data...", current: 0, total: ids.length });

    try {
      const dataRes = await generateDataForAssessment(selectedAssessmentObj, ids);
      const dataGenerated = dataRes.data.generated || 0;
      const dataErrors = dataRes.data.errors || [];

      setGenerateProgress({ step: "Data complete. Generating reports...", current: dataGenerated, total: ids.length });

      const freshMap = await refreshReportData();
      let reportIds = ids.filter((id) => freshMap.has(id));
      if (isNavigator) {
        reportIds = reportIds.filter((id) => {
          const rd = freshMap.get(id);
          return rd && rd.eligible !== false;
        });
      }

      if (reportIds.length === 0) {
        showSuccessToast(`Generated data for ${dataGenerated} student(s). No eligible students for reports.`);
        setGenerating(false); setGenerateProgress(null);
        return;
      }

      setGenerateProgress({ step: "Generating reports...", current: 0, total: reportIds.length });
      const reportRes = await generateReportsForAssessment(selectedAssessmentObj, reportIds);
      const reportsGenerated = reportRes.data.generated || 0;

      // Sync to centralized table
      for (const r of (reportRes.data.reports || []).filter((r: any) => r.reportUrl)) {
        createOrUpdateGeneratedReport({
          userStudentId: r.userStudentId,
          assessmentId: selectedAssessmentObj.id,
          typeOfReport: reportType,
          reportStatus: "generated",
          reportUrl: r.reportUrl,
        }).catch(() => {});
      }

      setGenerateProgress({ step: "Complete!", current: reportsGenerated, total: reportIds.length });
      const allErrors = [...dataErrors, ...(reportRes.data.errors || [])];
      showSuccessToast(`Data: ${dataGenerated} | Reports: ${reportsGenerated}${allErrors.length > 0 ? ` | ${allErrors.length} error(s)` : ""}`);
      await refreshReportData();
      await refreshVisibility();
    } catch (err: any) {
      showErrorToast("Failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
      setTimeout(() => setGenerateProgress(null), 2000);
    }
  };

  // ═══════════════════════ VISIBILITY ═══════════════════════

  const handleToggleVisibility = async (studentId: number) => {
    const entry = visibilityMap.get(studentId);
    if (!entry) return;
    const newVisible = !entry.visible;
    try {
      await toggleReportVisibility([entry.id], newVisible);
      setVisibilityMap((prev) => {
        const next = new Map(prev);
        next.set(studentId, { ...entry, visible: newVisible });
        return next;
      });
    } catch { showErrorToast("Failed to update visibility"); }
  };

  const handleBulkVisibility = async (visible: boolean) => {
    const ids = getSelectedOrAllIds()
      .map((sid) => visibilityMap.get(sid))
      .filter((e): e is { id: number; visible: boolean } => !!e && e.visible !== visible)
      .map((e) => e.id);
    if (ids.length === 0) {
      showSuccessToast(`All selected reports are already ${visible ? "released" : "hidden"}`);
      return;
    }
    setTogglingVisibility(true);
    try {
      await toggleReportVisibility(ids, visible);
      await refreshVisibility();
      showSuccessToast(`${ids.length} report(s) ${visible ? "released" : "hidden"}`);
    } catch { showErrorToast("Failed to update visibility"); }
    finally { setTogglingVisibility(false); }
  };

  // ═══════════════════════ DOWNLOAD ZIP → DO Spaces ═══════════════════════

  // Step 1: Click button → open name prompt
  const handleDownloadZipClick = () => {
    if (!selectedAssessmentObj) return;
    let ids = getSelectedOrAllIds().filter((id) => {
      const rd = reportDataMap.get(id);
      return rd && rd.reportStatus === "generated" && rd.reportUrl;
    });
    if (ids.length === 0) { showErrorToast("No generated reports to download."); return; }
    pendingZipIds.current = ids;
    setZipNameInput(`${reportType}_reports_${selectedAssessmentObj.assessmentName.replace(/[^a-zA-Z0-9]/g, "_")}`);
    setZipNamePromptOpen(true);
  };

  // Step 2: Confirm name → start async background job
  const startZipJob = (zipName: string) => {
    if (!selectedAssessmentObj) return;
    const assessment = selectedAssessmentObj;
    const ids = [...pendingZipIds.current];
    const jobId = `zip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fileName = zipName.endsWith(".zip") ? zipName : zipName + ".zip";

    const newJob: ZipJob = {
      id: jobId,
      name: fileName,
      status: "zipping",
      phase: "Fetching reports...",
      progress: 0,
      createdAt: Date.now(),
    };
    setZipJobs((prev) => [newJob, ...prev]);

    const updateJob = (patch: Partial<ZipJob>) => {
      setZipJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, ...patch } : j));
    };

    // Fire and forget
    (async () => {
      try {
        // Phase 1: Fetch report URLs
        const res = await getReportUrls(assessment, ids);
        const studs: { userStudentId: number; fileName: string }[] =
          res.data.reports.map((r: any) => ({ userStudentId: r.userStudentId, fileName: r.fileName }));
        const total = studs.length;

        // Phase 2: Fetch HTML in parallel
        const CONCURRENCY = 5;
        const htmlResults: { fileName: string; html: string | null }[] = new Array(total);
        let fetchDone = 0;
        const fetchQueue = studs.map((s, i) => [i, s] as [number, typeof s]);

        const fetchWorker = async () => {
          while (fetchQueue.length > 0) {
            const [idx, student] = fetchQueue.shift()!;
            try {
              const r = await downloadReport(assessment, student.userStudentId);
              const html = typeof r.data === "string" ? r.data : await new Blob([r.data]).text();
              htmlResults[idx] = { fileName: student.fileName, html };
            } catch {
              htmlResults[idx] = { fileName: student.fileName, html: null };
            }
            fetchDone++;
            updateJob({ phase: `Fetching ${fetchDone}/${total}...`, progress: (fetchDone / total) * 30 });
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => fetchWorker()));

        // Phase 3: Convert to PDF
        const zip = new JSZip();
        let convertDone = 0;
        for (const { fileName: fn, html } of htmlResults) {
          if (html) {
            try {
              const pdfBlob = await htmlToPdfBlob(html);
              zip.file(`${fn}.pdf`, pdfBlob);
            } catch { /* skip */ }
          }
          convertDone++;
          updateJob({ phase: `Converting ${convertDone}/${total}...`, progress: 30 + (convertDone / total) * 40 });
        }

        // Phase 4: Create ZIP blob
        updateJob({ phase: "Creating ZIP...", progress: 75 });
        const zipBlob = await zip.generateAsync({ type: "blob" });

        // Phase 5: Upload to DO Spaces
        updateJob({ status: "uploading", phase: "Uploading to cloud...", progress: 80 });
        const uploadRes = await uploadReportZip(zipBlob, fileName);
        const cdnUrl = uploadRes.data.url;

        updateJob({ status: "done", phase: undefined, progress: 100, url: cdnUrl });
        showSuccessToast(`"${fileName}" ready for download!`);
      } catch (err: any) {
        updateJob({
          status: "error",
          phase: undefined,
          error: err?.response?.data?.error || err.message || "Unknown error",
        });
        showErrorToast("ZIP generation failed.");
      }
    })();
  };

  // Delete a completed ZIP from DO Spaces
  const handleDeleteZipJob = async (job: ZipJob) => {
    if (!job.url) return;
    setDeletingJobs((prev) => new Set(prev).add(job.id));
    try {
      await deleteReportZip(job.url);
      setZipJobs((prev) => prev.filter((j) => j.id !== job.id));
      showSuccessToast(`"${job.name}" deleted.`);
    } catch (err: any) {
      showErrorToast("Delete failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setDeletingJobs((prev) => { const n = new Set(prev); n.delete(job.id); return n; });
    }
  };

  const activeZipJobs = zipJobs.filter((j) => j.status === "zipping" || j.status === "uploading");

  // ═══════════════════════ MIRA DESAI ACTIONS ═══════════════════════

  const handleGenerateDataExcel = async () => {
    if (!selectedAssessmentObj) return;
    const ids = getSelectedOrAllIds();
    if (ids.length === 0) { showErrorToast("No students."); return; }
    setExportingDataExcel(true);
    try {
      const res = await generateAndExportNavigatorExcel(selectedAssessmentObj.id, ids);
      downloadBlob(res.data, `navigator_data_${selectedAssessmentObj.id}.xlsx`);
      showSuccessToast(`Generated data for ${ids.length} student(s).`);
    } catch (err: any) { showErrorToast("Generation failed: " + (err?.response?.data?.error || err.message)); }
    finally { setExportingDataExcel(false); }
  };

  const handleExportBetCoreData = async () => {
    if (!selectedAssessmentObj) return;
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    const selectedVisible = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
    const ids = selectedVisible.length > 0 ? selectedVisible : undefined;
    setExportingMQT(true);
    try {
      const res = await exportMqtScoresExcel(selectedAssessmentObj.id, ids);
      downloadBlob(res.data, `bet_core_data_${selectedAssessmentObj.id}.xlsx`);
    } catch (err: any) { showErrorToast("Export failed: " + (err?.response?.data?.error || err.message)); }
    finally { setExportingMQT(false); }
  };

  // ═══════════════════════ SEND ACTIONS ═══════════════════════

  const handleSendEmail = (student: StudentRow) => {
    const rd = reportDataMap.get(student.userStudentId);
    if (!student.email || !rd?.reportUrl) return;
    setComposeStudentIds([student.userStudentId]);
    setComposeRecipients([{ email: student.email, name: student.name }]);
    setComposeSubject(`Your ${selectedAssessmentName} Report - Career-9`);
    setComposeBody(buildEmailTemplate(student.name, rd.reportUrl, selectedAssessmentName));
    setComposeOpen(true);
  };

  const handleSendWhatsApp = async (student: StudentRow) => {
    const rd = reportDataMap.get(student.userStudentId);
    if (!student.phoneNumber || !rd?.reportUrl) return;
    setSendingWhatsApp((prev) => new Set(prev).add(student.userStudentId));
    try {
      await SendWhatsApp(student.phoneNumber, "report_notification", [
        student.name, selectedAssessmentName, rd.reportUrl,
      ]);
      showSuccessToast(`WhatsApp sent to ${student.name}`);
    } catch (err: any) {
      showErrorToast(`WhatsApp failed for ${student.name}: ${err?.response?.data?.error || err.message}`);
    } finally {
      setSendingWhatsApp((prev) => { const n = new Set(prev); n.delete(student.userStudentId); return n; });
    }
  };

  const handleBulkEmail = () => {
    const selected = getSelectedOrAllIds()
      .map((id) => {
        const s = displayedStudents.find((st) => st.userStudentId === id);
        const rd = reportDataMap.get(id);
        return s && s.email && rd?.reportUrl ? { ...s, reportUrl: rd.reportUrl } : null;
      })
      .filter((s): s is StudentRow & { reportUrl: string } => !!s);
    if (selected.length === 0) { showErrorToast("No students with email + generated reports."); return; }
    setComposeStudentIds(selected.map((s) => s.userStudentId));
    setComposeRecipients(selected.map((s) => ({ email: s.email!, name: s.name })));
    setComposeSubject(`Your ${selectedAssessmentName} Report - Career-9`);
    setComposeBody(buildEmailTemplate("{{student_name}}", "{{report_link}}", selectedAssessmentName));
    setComposeOpen(true);
  };

  const handleComposeSend = async (emails: string[], subject: string, body: string) => {
    setComposeSending(true);
    try {
      if (emails.length === 1 && composeStudentIds.length === 1) {
        await SendReportEmail(emails, subject, body);
        showSuccessToast(`Email sent to ${emails[0]}`);
      } else {
        // Bulk: personalize for each student
        const studentsToSend = composeStudentIds
          .map((id) => {
            const s = displayedStudents.find((st) => st.userStudentId === id);
            const rd = reportDataMap.get(id);
            return s && s.email ? { name: s.name, email: s.email, reportUrl: rd?.reportUrl || "" } : null;
          })
          .filter((s): s is { name: string; email: string; reportUrl: string } => !!s);

        let sentCount = 0;
        for (const student of studentsToSend) {
          const personalizedBody = body
            .replace(/\{\{student_name\}\}/g, student.name)
            .replace(/\{\{report_link\}\}/g, student.reportUrl);
          try {
            await SendReportEmail([student.email], subject, personalizedBody);
            sentCount++;
          } catch { /* continue */ }
        }
        showSuccessToast(`${sentCount}/${studentsToSend.length} email(s) sent.`);
      }
      setComposeOpen(false);
    } catch (err: any) {
      showErrorToast(`Send failed: ${err?.response?.data || err.message}`);
    } finally {
      setComposeSending(false);
    }
  };

  const handleBulkWhatsApp = async () => {
    const selected = getSelectedOrAllIds()
      .map((id) => {
        const s = displayedStudents.find((st) => st.userStudentId === id);
        const rd = reportDataMap.get(id);
        return s && s.phoneNumber && rd?.reportUrl
          ? { phoneNumber: s.phoneNumber, name: s.name, reportUrl: rd.reportUrl }
          : null;
      })
      .filter((s): s is { phoneNumber: string; name: string; reportUrl: string } => !!s);
    if (selected.length === 0) { showErrorToast("No students with phone + generated reports."); return; }
    try {
      const recipients = selected.map((s) => ({
        phoneNumber: s.phoneNumber,
        templateParams: [s.name, selectedAssessmentName, s.reportUrl],
      }));
      const res = await SendWhatsAppBulk("report_notification", recipients);
      const d = res.data;
      showSuccessToast(`WhatsApp: ${d.successCount} sent, ${d.failCount} failed of ${d.totalRecipients}`);
    } catch (err: any) {
      showErrorToast(`Bulk WhatsApp failed: ${err?.response?.data?.error || err.message}`);
    }
  };

  // ═══════════════════════ STYLES ═══════════════════════

  const thStyle: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, color: "#1a1a2e", borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "0.85rem" };
  const tdStyle: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontSize: "0.85rem" };
  const statusBadge = (bg: string, color: string, text: string) => (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 6, fontWeight: 600, fontSize: "0.75rem" }}>{text}</span>
  );

  const countLabel = visibleSelectedCount > 0 ? ` (${visibleSelectedCount})` : ` (All ${displayedStudents.length})`;

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1500, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>
          Reports Hub
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Generate, manage, export, and send reports from one place
        </p>
      </div>

      {/* Selection Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24,
        background: "#fff", padding: 20, borderRadius: 12,
        border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>
            School / Institute
          </label>
          {institutesLoading ? (
            <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
          ) : (
            <select className="form-select form-select-solid" value={selectedInstitute}
              onChange={(e) => setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">-- Select a school --</option>
              {institutes.map((inst) => (
                <option key={inst.instituteCode} value={inst.instituteCode}>{inst.instituteName}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>
            Assessment
          </label>
          {assessmentsLoading ? (
            <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
          ) : (
            <select className="form-select form-select-solid" value={selectedAssessment}
              disabled={selectedInstitute === ""}
              onChange={(e) => setSelectedAssessment(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">-- Select an assessment --</option>
              {assessments.map((a) => {
                const type = getReportType(a);
                return <option key={a.id} value={a.id}>{a.assessmentName} [{type.toUpperCase()}]</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!ready && (
        <div style={{
          padding: 48, textAlign: "center", color: "#9ca3af",
          border: "2px dashed #e5e7eb", borderRadius: 12, background: "#fff",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.4 }}>&#x1F4CA;</div>
          <div>Select a school and assessment to get started</div>
        </div>
      )}

      {/* Main content */}
      {ready && (
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", padding: 24,
        }}>
          {/* Summary bar */}
          <div style={{
            padding: "12px 20px", background: accentColor + "10", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap",
          }}>
            <span style={{ fontWeight: 700, color: accentColor }}>{selectedInstituteName}</span>
            <span style={{ color: "#cbd5e1" }}>/</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{selectedAssessmentName}</span>
            <span style={{
              background: accentColor + "18", color: accentColor,
              padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: "0.75rem",
            }}>{reportType.toUpperCase()}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <span style={{ background: accentColor, color: "#fff", padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600 }}>
                {assessmentStudents.length} students
              </span>
              <span style={{ background: "#4361ee", color: "#fff", padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600 }}>
                {reportStats.generated} reports
              </span>
            </div>
          </div>

          {studentsLoading || reportDataLoading ? (
            <div style={{ color: "#9ca3af", padding: 24 }}>Loading...</div>
          ) : (
            <>
              {/* Search + Filters */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Search</label>
                  <input className="form-control form-control-sm form-control-solid"
                    placeholder="Name, roll no, email, DOB..."
                    value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
                </div>
                <div style={{ minWidth: 140 }}>
                  <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Grade / Class</label>
                  <select className="form-select form-select-sm form-select-solid" value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}>
                    <option value="">All</option>
                    {uniqueGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 140 }}>
                  <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Section</label>
                  <select className="form-select form-select-sm form-select-solid" value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}>
                    <option value="">All</option>
                    {uniqueSections.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 160 }}>
                  <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Status</label>
                  <select
                    className="form-select form-select-sm form-select-solid"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as "" | "completed" | "ongoing" | "notstarted")}
                    disabled={!selectedAssessmentObj}
                    title={!selectedAssessmentObj ? "Select an assessment first" : ""}
                  >
                    <option value="">All</option>
                    <option value="completed">Completed</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="notstarted">Not Started</option>
                  </select>
                </div>
              </div>

              {/* Action bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexWrap: "wrap", gap: 8,
              }}>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {displayedStudents.length} student(s)
                  {visibleSelectedCount > 0 && (
                    <span style={{ fontWeight: 600, color: accentColor, marginLeft: 8 }}>
                      ({visibleSelectedCount} selected)
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* Mira Desai */}
                  <button className="btn btn-sm" onClick={() => setMiraDesaiOpen(true)}
                    style={{
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      border: "none", borderRadius: 8, padding: "8px 20px",
                      fontWeight: 600, color: "white", fontSize: "0.85rem",
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
                    }}>
                    Mira Desai
                  </button>

                  {/* Generate All */}
                  <button className="btn btn-sm" disabled={displayedStudents.length === 0 || generating}
                    onClick={handleGenerate}
                    style={{
                      background: generating ? "#6c757d" : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                      border: "none", borderRadius: 8, padding: "8px 20px",
                      fontWeight: 600, color: "white", fontSize: "0.85rem",
                    }}>
                    {generating ? "Generating..." : `Generate${countLabel}`}
                  </button>

                  {/* Download ZIP */}
                  <button className="btn btn-sm" disabled={reportStats.generated === 0}
                    onClick={handleDownloadZipClick}
                    style={{
                      background: reportStats.generated === 0 ? "#6c757d" : "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                      border: "none", borderRadius: 8, padding: "8px 20px",
                      fontWeight: 600, color: "white", fontSize: "0.85rem",
                    }}>
                    Download ZIP
                  </button>

                  {/* Downloads Manager */}
                  <button className="btn btn-sm" onClick={() => setDownloadsOpen(true)}
                    style={{
                      background: activeZipJobs.length > 0
                        ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                        : "#f3f4f6",
                      border: activeZipJobs.length > 0 ? "none" : "1px solid #d1d5db",
                      borderRadius: 8, padding: "8px 16px",
                      fontWeight: 600, color: activeZipJobs.length > 0 ? "white" : "#374151",
                      fontSize: "0.85rem", position: "relative",
                    }}>
                    Downloads
                    {zipJobs.length > 0 && (
                      <span style={{
                        position: "absolute", top: -6, right: -6,
                        background: activeZipJobs.length > 0 ? "#dc2626" : "#4361ee",
                        color: "#fff", borderRadius: "50%", width: 18, height: 18,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.65rem", fontWeight: 700,
                      }}>
                        {zipJobs.length}
                      </span>
                    )}
                  </button>

                  {/* Release / Hide */}
                  <button className="btn btn-sm" disabled={togglingVisibility || reportStats.generated === 0}
                    onClick={() => handleBulkVisibility(true)}
                    style={{
                      background: togglingVisibility ? "#6c757d" : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      border: "none", borderRadius: 8, padding: "8px 20px",
                      fontWeight: 600, color: "white", fontSize: "0.85rem",
                    }}>
                    {togglingVisibility ? "..." : `Release${countLabel}`}
                  </button>
                  <button className="btn btn-sm" disabled={togglingVisibility || reportStats.generated === 0}
                    onClick={() => handleBulkVisibility(false)}
                    style={{
                      background: togglingVisibility ? "#6c757d" : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      border: "none", borderRadius: 8, padding: "8px 20px",
                      fontWeight: 600, color: "white", fontSize: "0.85rem",
                    }}>
                    {togglingVisibility ? "..." : "Hide"}
                  </button>

                  {/* Bulk Send */}
                  <button className="btn btn-sm"
                    onClick={() => setBulkSendOpen(true)}
                    disabled={reportStats.generated === 0}
                    style={{
                      background: reportStats.generated === 0 ? "#6c757d" : "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                      border: "none", borderRadius: 8, padding: "8px 20px",
                      fontWeight: 600, color: "white", fontSize: "0.85rem",
                      boxShadow: reportStats.generated === 0 ? "none" : "0 4px 12px rgba(225, 29, 72, 0.3)",
                    }}>
                    Bulk Send
                  </button>
                </div>
              </div>

              {/* Progress bars */}
              {generateProgress && (
                <div style={{ marginBottom: 12, padding: "10px 16px", background: "#f0f4ff", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.8rem", color: "#4361ee", fontWeight: 600 }}>{generateProgress.step}</span>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{generateProgress.current}/{generateProgress.total}</span>
                  </div>
                  <div style={{ height: 6, background: "#e0e7ff", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, transition: "width 0.3s",
                      background: "linear-gradient(90deg, #4361ee, #7c3aed)",
                      width: generateProgress.total > 0 ? `${(generateProgress.current / generateProgress.total) * 100}%` : "0%",
                    }} />
                  </div>
                </div>
              )}

              {/* Table */}
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ ...thStyle, width: 40 }}>
                        <input type="checkbox"
                          checked={paginatedStudents.length > 0 && paginatedStudents.every((s) => selectedStudentIds.has(s.userStudentId))}
                          onChange={(e) => {
                            setSelectedStudentIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) paginatedStudents.forEach((s) => next.add(s.userStudentId));
                              else paginatedStudents.forEach((s) => next.delete(s.userStudentId));
                              return next;
                            });
                          }} />
                      </th>
                      <th style={{ ...thStyle, width: 44 }}>#</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Grade</th>
                      <th style={thStyle}>Section</th>
                      <th style={thStyle}>Report</th>
                      <th style={thStyle}>Visible</th>
                      <th style={thStyle}>Preview / Download</th>
                      <th style={thStyle}>Nav 360</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((s, idx) => {
                      const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                      const secInfo = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
                      const asmtStatus = (s.assessments || []).find(
                        (a) => a.assessmentId === selectedAssessmentObj!.id
                      )?.status || "notstarted";
                      const rd = reportDataMap.get(s.userStudentId);
                      const reportStatus = rd?.reportStatus || "notGenerated";
                      const reportUrl = rd?.reportUrl || null;
                      const hasReport = reportStatus === "generated" && !!reportUrl;

                      const asc = asmtStatus === "completed" ? { bg: "#dcfce7", color: "#059669" }
                        : asmtStatus === "ongoing" ? { bg: "#dbeafe", color: "#2563eb" }
                        : { bg: "#fef3c7", color: "#d97706" };
                      const rsc = hasReport ? { bg: "#dcfce7", color: "#059669" } : { bg: "#fef3c7", color: "#d97706" };

                      return (
                        <tr key={s.userStudentId} style={{
                          background: selectedStudentIds.has(s.userStudentId)
                            ? accentColor + "08"
                            : globalIdx % 2 === 0 ? "#fff" : "#f9fafb",
                        }}>
                          <td style={tdStyle}>
                            <input type="checkbox" checked={selectedStudentIds.has(s.userStudentId)}
                              onChange={(e) => {
                                const next = new Set(selectedStudentIds);
                                if (e.target.checked) next.add(s.userStudentId); else next.delete(s.userStudentId);
                                setSelectedStudentIds(next);
                              }} />
                          </td>
                          <td style={tdStyle}>{globalIdx + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name || "-"}</td>
                          <td style={tdStyle}>{statusBadge(asc.bg, asc.color, asmtStatus)}</td>
                          <td style={tdStyle}>{secInfo?.className || "-"}</td>
                          <td style={tdStyle}>{secInfo?.sectionName || "-"}</td>
                          <td style={tdStyle}>{statusBadge(rsc.bg, rsc.color, hasReport ? "Generated" : "Not Generated")}</td>
                          <td style={tdStyle}>
                            {visibilityMap.has(s.userStudentId) ? (
                              <label style={{ position: "relative", display: "inline-block", width: 36, height: 20, cursor: "pointer" }}>
                                <input type="checkbox" checked={visibilityMap.get(s.userStudentId)!.visible}
                                  onChange={() => handleToggleVisibility(s.userStudentId)}
                                  style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                                <span style={{
                                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10,
                                  background: visibilityMap.get(s.userStudentId)!.visible ? "#059669" : "#d1d5db",
                                  transition: "background 0.2s",
                                }}>
                                  <span style={{
                                    position: "absolute", left: visibilityMap.get(s.userStudentId)!.visible ? 18 : 2, top: 2,
                                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                                    transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                                  }} />
                                </span>
                              </label>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>-</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {reportUrl ? (
                              <div style={{ display: "flex", gap: 4 }}>
                                <a href={reportUrl} target="_blank" rel="noopener noreferrer"
                                  style={{
                                    padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem",
                                    fontWeight: 600, background: "#dbeafe", color: "#2563eb", textDecoration: "none",
                                  }}>
                                  Preview
                                </a>
                                <button
                                  disabled={downloadingStudentId === s.userStudentId}
                                  style={{
                                    padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600,
                                    background: downloadingStudentId === s.userStudentId ? "#d1d5db" : "#f0fdf4",
                                    color: downloadingStudentId === s.userStudentId ? "#6b7280" : "#059669",
                                    border: "none", cursor: downloadingStudentId === s.userStudentId ? "not-allowed" : "pointer",
                                  }}
                                  onClick={async () => {
                                    if (!selectedAssessmentObj) return;
                                    setDownloadingStudentId(s.userStudentId);
                                    try {
                                      const safeName = (s.name || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
                                      const reportLabel = isBet ? "BET_Report" : "Career_Navigator";
                                      await downloadReportAsPdf(
                                        () => downloadReport(selectedAssessmentObj, s.userStudentId),
                                        `${safeName}_${reportLabel}.pdf`
                                      );
                                    } catch { showErrorToast("Download failed"); }
                                    finally { setDownloadingStudentId(null); }
                                  }}>
                                  {downloadingStudentId === s.userStudentId ? "..." : "Download"}
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>-</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {asmtStatus === "completed" && (
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  onClick={() => setNav360Preview({ studentId: s.userStudentId, studentName: s.name || "Student" })}
                                  style={{
                                    padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600,
                                    background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                                    color: "#fff", border: "none", cursor: "pointer",
                                    boxShadow: "0 2px 6px rgba(124,58,237,0.3)",
                                  }}>
                                  Preview
                                </button>
                              </div>
                            )}
                            {asmtStatus !== "completed" && (
                              <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>-</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {hasReport && (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button
                                  className="btn btn-light-primary btn-sm"
                                  disabled={!s.email}
                                  onClick={() => handleSendEmail(s)}
                                  title={s.email ? `Email to ${s.email}` : "No email"}
                                  style={{ padding: "4px 8px", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 3 }}>
                                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  Email
                                </button>
                                <button
                                  className="btn btn-light-success btn-sm"
                                  disabled={!s.phoneNumber || sendingWhatsApp.has(s.userStudentId)}
                                  onClick={() => handleSendWhatsApp(s)}
                                  title={s.phoneNumber ? `WhatsApp to ${s.phoneNumber}` : "No phone"}
                                  style={{ padding: "4px 8px", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 3 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                  WA
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 12, flexWrap: "wrap", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, displayedStudents.length)} of {displayedStudents.length}
                    </span>
                    <select className="form-select form-select-sm form-select-solid"
                      style={{ width: 68, fontSize: "0.8rem" }} value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                      {[25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(1)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>First</button>
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Prev</button>
                    {(() => {
                      const pages: (number | string)[] = [];
                      const maxV = 5;
                      let start = Math.max(1, safeCurrentPage - Math.floor(maxV / 2));
                      let end = Math.min(totalPages, start + maxV - 1);
                      if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
                      if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
                      for (let i = start; i <= end; i++) pages.push(i);
                      if (end < totalPages) { if (end < totalPages - 1) pages.push("..."); pages.push(totalPages); }
                      return pages.map((p, i) =>
                        typeof p === "string" ? (
                          <span key={`e-${i}`} style={{ padding: "4px 4px", color: "#9ca3af", fontSize: "0.8rem" }}>...</span>
                        ) : (
                          <button key={p} className={`btn btn-sm ${p === safeCurrentPage ? "btn-primary" : "btn-light"}`}
                            onClick={() => setCurrentPage(p)} style={{ padding: "4px 10px", fontSize: "0.8rem", minWidth: 32 }}>{p}</button>
                        )
                      );
                    })()}
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Next</button>
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Last</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}

      <MiraDesaiModal
        open={miraDesaiOpen}
        onClose={() => setMiraDesaiOpen(false)}
        isNavigator={isNavigator}
        generating={exportingDataExcel}
        exportingMQT={exportingMQT}
        onGenerateDataExcel={handleGenerateDataExcel}
        onExportBetCoreData={handleExportBetCoreData}
        onSchoolReport={() => setSchoolReportOpen(true)}
        visibleSelectedCount={visibleSelectedCount}
        displayedCount={displayedStudents.length}
      />

      <SchoolReportModal
        open={schoolReportOpen}
        onClose={() => setSchoolReportOpen(false)}
        assessmentId={Number(selectedAssessment) || 0}
        assessmentName={selectedAssessmentName}
        instituteName={selectedInstituteName}
        instituteCode={Number(selectedInstitute) || 0}
        userStudentIds={
          (() => {
            const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
            const selectedVisible = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
            return selectedVisible.length > 0 ? selectedVisible : undefined;
          })()
        }
      />

      <BulkSendModal
        open={bulkSendOpen}
        onClose={() => setBulkSendOpen(false)}
        selectedCount={visibleSelectedCount > 0 ? visibleSelectedCount : displayedStudents.length}
        sendingEmail={composeSending}
        sendingWhatsApp={false}
        onBulkEmail={handleBulkEmail}
        onBulkWhatsApp={handleBulkWhatsApp}
      />

      <EmailComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        studentIds={composeStudentIds}
        initialRecipients={composeRecipients}
        initialSubject={composeSubject}
        initialBody={composeBody}
        sending={composeSending}
        onSend={handleComposeSend}
      />

      {/* Downloads Modal */}
      <DownloadsModal
        open={downloadsOpen}
        onClose={() => setDownloadsOpen(false)}
        jobs={zipJobs}
        onDelete={handleDeleteZipJob}
        deleting={deletingJobs}
      />

      {/* ZIP Name Prompt Modal */}
      {zipNamePromptOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1050,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.45)",
        }} onClick={() => setZipNamePromptOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, width: 420, maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: "1px solid #e5e7eb",
            }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                Name your ZIP
              </h3>
              <button onClick={() => setZipNamePromptOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "1.4rem", color: "#9ca3af", lineHeight: 1, padding: 4,
              }}>&times;</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <input
                type="text"
                className="form-control form-control-solid"
                value={zipNameInput}
                onChange={(e) => setZipNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && zipNameInput.trim()) {
                    setZipNamePromptOpen(false);
                    startZipJob(zipNameInput.trim());
                  }
                }}
                placeholder="e.g. Class_10_BET_Reports"
                autoFocus
              />
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 6 }}>
                This name will appear in Downloads and on DO Spaces.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className="btn btn-light" onClick={() => setZipNamePromptOpen(false)}
                  style={{ borderRadius: 8 }}>
                  Cancel
                </button>
                <button className="btn" disabled={!zipNameInput.trim()}
                  onClick={() => { setZipNamePromptOpen(false); startZipJob(zipNameInput.trim()); }}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                    border: "none", borderRadius: 8, padding: "10px 24px",
                    fontWeight: 600, color: "white", fontSize: "0.9rem",
                  }}>
                  Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating mini-indicator for active jobs (bottom-right) */}
      {activeZipJobs.length > 0 && !downloadsOpen && (
        <div
          onClick={() => setDownloadsOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 1100,
            width: 300, background: "#fff", borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb",
            overflow: "hidden", cursor: "pointer",
          }}
        >
          <div style={{
            padding: "10px 16px", background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem" }}>
              {activeZipJobs.length} ZIP{activeZipJobs.length > 1 ? "s" : ""} processing
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
              style={{ animation: "spin 1s linear infinite" }}>
              <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
            </svg>
          </div>
          {activeZipJobs.slice(0, 2).map((job) => (
            <div key={job.id} style={{ padding: "8px 16px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1a1a2e", marginBottom: 3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {job.name}
              </div>
              <div style={{ height: 4, background: "#ede9fe", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2, transition: "width 0.3s ease",
                  background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                  width: `${job.progress}%`,
                }} />
              </div>
              <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 2 }}>{job.phase}</div>
            </div>
          ))}
          <div style={{ padding: "6px 16px", fontSize: "0.7rem", color: "#7c3aed", fontWeight: 600, textAlign: "center" }}>
            Click to view all
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Navigator 360 Preview Modal */}
      {nav360Preview && selectedAssessment && (
        <Navigator360Preview
          studentId={nav360Preview.studentId}
          assessmentId={Number(selectedAssessment)}
          studentName={nav360Preview.studentName}
          onClose={() => setNav360Preview(null)}
        />
      )}
    </div>
  );
};

// ═══════════════════════ EMAIL TEMPLATE ═══════════════════════

function buildEmailTemplate(studentName: string, reportUrl: string, assessmentName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:#1a1a2e;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Career-9</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="font-size:16px;color:#333;">Dear <strong>${studentName}</strong>,</p>
      <p style="font-size:14px;color:#555;line-height:1.6;">
        Your <strong>${assessmentName}</strong> report is ready! Click the button below to view your personalized report.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${reportUrl}" style="background:#4361ee;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
          View Your Report
        </a>
      </div>
      <p style="font-size:13px;color:#888;">If the button doesn't work, copy this link: <a href="${reportUrl}" style="color:#4361ee;">${reportUrl}</a></p>
    </td>
  </tr>
  <tr>
    <td style="background:#f8f9fa;padding:16px 32px;text-align:center;">
      <p style="font-size:12px;color:#999;margin:0;">Career-9 Assessment Platform</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`;
}

export default ReportsHubPage;
