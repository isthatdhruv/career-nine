import JSZip from "jszip";

export type ZipItem = { fileName: string; pdfUrl: string | null | undefined };

/**
 * Bundle already-rendered PDFs (stored on Spaces) into a ZIP. No html2canvas:
 * the PDFs already exist server-side, so this is just fetch + zip.
 * Returns the zip blob plus which items were added/skipped (no pdf / fetch failed).
 */
export async function zipStoredPdfs(
  items: ZipItem[],
  fetchFn: typeof fetch = fetch
): Promise<{ blob: Blob; added: number; skipped: string[] }> {
  const zip = new JSZip();
  const skipped: string[] = [];
  let added = 0;

  for (const it of items) {
    if (!it.pdfUrl) { skipped.push(it.fileName); continue; }
    try {
      const res = await fetchFn(it.pdfUrl);
      if (!res.ok) { skipped.push(it.fileName); continue; }
      const blob = await res.blob();
      zip.file(`${it.fileName}.pdf`, blob);
      added++;
    } catch {
      skipped.push(it.fileName);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, added, skipped };
}
