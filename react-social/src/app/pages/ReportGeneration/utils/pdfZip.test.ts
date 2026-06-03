import { zipStoredPdfs } from "./pdfZip";

describe("zipStoredPdfs", () => {
  it("fetches each pdfUrl and adds it to the zip under fileName.pdf", async () => {
    const fetched: string[] = [];
    const fakeFetch = async (url: string) => {
      fetched.push(url);
      return { ok: true, blob: async () => new Blob([url], { type: "application/pdf" }) } as any;
    };
    const items = [
      { fileName: "Asha_report", pdfUrl: "https://cdn/a.pdf" },
      { fileName: "Ravi_report", pdfUrl: "https://cdn/b.pdf" },
    ];
    const { blob, added, skipped } = await zipStoredPdfs(items, fakeFetch as any);
    expect(fetched).toEqual(["https://cdn/a.pdf", "https://cdn/b.pdf"]);
    expect(added).toBe(2);
    expect(skipped).toEqual([]);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("skips items without a pdfUrl or with a failed fetch", async () => {
    const fakeFetch = async () => ({ ok: false } as any);
    const items = [
      { fileName: "NoPdf", pdfUrl: null },
      { fileName: "Broken", pdfUrl: "https://cdn/x.pdf" },
    ];
    const { added, skipped } = await zipStoredPdfs(items, fakeFetch as any);
    expect(added).toBe(0);
    expect(skipped.sort()).toEqual(["Broken", "NoPdf"]);
  });
});
