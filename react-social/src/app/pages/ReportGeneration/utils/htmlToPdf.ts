import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import JSZip from "jszip";

export type ZipProgress = {
  phase: "fetching" | "converting" | "zipping";
  done: number;
  total: number;
  currentName?: string;
};

/**
 * Render an HTML string into a PDF blob using html2canvas + jsPDF.
 * Captures each .page element as a separate PDF page.
 */
export async function htmlToPdfBlob(htmlString: string): Promise<Blob> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "960px";
  iframe.style.height = "1400px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error("Could not access iframe document");

    iframeDoc.open();
    iframeDoc.write(htmlString);
    iframeDoc.close();

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      setTimeout(resolve, 5000);
    });
    await new Promise((r) => setTimeout(r, 500));

    const pages = iframeDoc.querySelectorAll(".page");
    const elements: HTMLElement[] =
      pages.length > 0
        ? (Array.from(pages) as HTMLElement[])
        : [iframeDoc.body];

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
    const A4_W = 210;
    const A4_H = 297;

    const style = iframeDoc.createElement("style");
    style.textContent = `
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      img { image-rendering: -webkit-optimize-contrast; }
    `;
    iframeDoc.head.appendChild(style);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 5000,
      });

      const TARGET_PX_WIDTH = 2400;
      const smallCanvas = downscaleCanvas(canvas, TARGET_PX_WIDTH);
      const jpegDataUrl = smallCanvas.toDataURL("image/jpeg", 0.92);

      const imgRatio = smallCanvas.height / smallCanvas.width;
      let imgW = A4_W;
      let imgH = A4_W * imgRatio;
      if (imgH > A4_H) {
        imgH = A4_H;
        imgW = A4_H / imgRatio;
      }
      const xOffset = (A4_W - imgW) / 2;

      if (i > 0) pdf.addPage();
      pdf.addImage(jpegDataUrl, "JPEG", xOffset, 0, imgW, imgH);
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}

function downscaleCanvas(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  if (source.width <= targetWidth) return source;
  const ratio = targetWidth / source.width;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = Math.round(source.height * ratio);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Download a single report as PDF.
 */
export async function downloadReportAsPdf(
  fetchHtml: () => Promise<any>,
  fileName: string
): Promise<void> {
  const res = await fetchHtml();
  const htmlString =
    typeof res.data === "string"
      ? res.data
      : await new Blob([res.data]).text();

  const pdfBlob = await htmlToPdfBlob(htmlString);
  triggerDownload(pdfBlob, fileName);
}

/**
 * Batch download with parallel HTML fetching + progress.
 *
 * Phase 1: Fetch all HTML in parallel (fast — network bound)
 * Phase 2: Convert each to PDF sequentially (html2canvas needs DOM)
 * Phase 3: Bundle ZIP
 */
export async function downloadReportsAsZip(
  students: { userStudentId: number; fileName: string }[],
  zipFileName: string,
  fetchHtmlForStudent: (userStudentId: number) => Promise<any>,
  onProgress?: (progress: ZipProgress) => void
): Promise<void> {
  const total = students.length;

  // Phase 1: Fetch all HTML in parallel with concurrency limit
  onProgress?.({ phase: "fetching", done: 0, total });
  const CONCURRENCY = 5;
  const htmlResults: { fileName: string; html: string | null }[] = new Array(total);
  let fetchDone = 0;

  const fetchQueue = students.map((s, i) => [i, s] as [number, typeof s]);
  const fetchWorker = async () => {
    while (fetchQueue.length > 0) {
      const [idx, student] = fetchQueue.shift()!;
      try {
        const res = await fetchHtmlForStudent(student.userStudentId);
        const html =
          typeof res.data === "string"
            ? res.data
            : await new Blob([res.data]).text();
        htmlResults[idx] = { fileName: student.fileName, html };
      } catch (err) {
        console.error(`Failed to fetch ${student.fileName}:`, err);
        htmlResults[idx] = { fileName: student.fileName, html: null };
      }
      fetchDone++;
      onProgress?.({ phase: "fetching", done: fetchDone, total, currentName: student.fileName });
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => fetchWorker()));

  // Phase 2: Convert to PDF sequentially (html2canvas uses DOM)
  const zip = new JSZip();
  let convertDone = 0;

  for (const { fileName, html } of htmlResults) {
    if (!html) {
      convertDone++;
      onProgress?.({ phase: "converting", done: convertDone, total, currentName: fileName });
      continue;
    }
    try {
      const pdfBlob = await htmlToPdfBlob(html);
      zip.file(`${fileName}.pdf`, pdfBlob);
    } catch (err) {
      console.error(`Failed to convert ${fileName}:`, err);
    }
    convertDone++;
    onProgress?.({ phase: "converting", done: convertDone, total, currentName: fileName });
  }

  // Phase 3: Generate ZIP
  onProgress?.({ phase: "zipping", done: 0, total: 1 });
  const zipBlob = await zip.generateAsync({ type: "blob" });
  onProgress?.({ phase: "zipping", done: 1, total: 1 });
  triggerDownload(zipBlob, zipFileName);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
