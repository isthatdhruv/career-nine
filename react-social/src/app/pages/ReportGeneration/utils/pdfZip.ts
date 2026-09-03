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

export type ZipPart = { blob: Blob; fileCount: number };

/**
 * Multipart variant: bundles the PDFs into one or more ZIPs, each capped at
 * `maxPartBytes` of RAW pdf bytes (PDFs barely compress, so the cap tracks
 * the final zip size closely). Files are NEVER split across parts — a file
 * that would push the current part over the cap closes it and starts the
 * next; a single file larger than the cap gets a part of its own.
 *
 * Streams memory-consciously: only the current part's raw blobs are held;
 * each finished part is handed to `onPart` immediately and released.
 * `fetchBlob` owns the download strategy (direct fetch, proxy fallback, …).
 */
export async function zipStoredPdfsInParts(
  items: ZipItem[],
  maxPartBytes: number,
  fetchBlob: (url: string) => Promise<Blob | null>,
  onPart: (part: ZipPart, index: number) => Promise<void> | void
): Promise<{ partCount: number; added: number; skipped: string[] }> {
  const skipped: string[] = [];
  let added = 0;
  let partIndex = 0;
  let current: { fileName: string; blob: Blob }[] = [];
  let currentBytes = 0;

  const flush = async () => {
    if (current.length === 0) return;
    const zip = new JSZip();
    for (const f of current) zip.file(`${f.fileName}.pdf`, f.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    await onPart({ blob, fileCount: current.length }, partIndex);
    partIndex++;
    current = [];
    currentBytes = 0;
  };

  for (const it of items) {
    if (!it.pdfUrl) {
      skipped.push(it.fileName);
      continue;
    }
    const blob = await fetchBlob(it.pdfUrl);
    if (!blob || blob.size === 0) {
      skipped.push(it.fileName);
      continue;
    }
    if (current.length > 0 && currentBytes + blob.size > maxPartBytes) {
      await flush();
    }
    current.push({ fileName: it.fileName, blob });
    currentBytes += blob.size;
    added++;
  }
  await flush();

  return { partCount: partIndex, added, skipped };
}
