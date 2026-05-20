import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Renders an HTML string into a PDF blob using html2canvas + jsPDF. Each
 * {@code .page} element in the template is captured as a separate PDF page;
 * if no {@code .page} elements exist, the document body is captured as one
 * page. A4 portrait, JPEG-encoded canvases at quality 0.92.
 *
 * Ported (single-download path) from the admin app's
 * {@code react-social/.../ReportGeneration/utils/htmlToPdf.ts}. The
 * batch-zip helpers were intentionally not ported — the student app only
 * needs the one-off download flow.
 */
export async function htmlToPdfBlob(htmlString: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '960px'
  iframe.style.height = '1400px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) throw new Error('Could not access iframe document')

    iframeDoc.open()
    iframeDoc.write(htmlString)
    iframeDoc.close()

    // Wait for iframe + remote assets (fonts, images) — fail-open after 5s.
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
      setTimeout(resolve, 5000)
    })
    await new Promise((r) => setTimeout(r, 500))

    const pages = iframeDoc.querySelectorAll('.page')
    const elements: HTMLElement[] =
      pages.length > 0 ? (Array.from(pages) as HTMLElement[]) : [iframeDoc.body]

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
    const A4_W = 210
    const A4_H = 297

    const style = iframeDoc.createElement('style')
    style.textContent =
      '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } ' +
      'img { image-rendering: -webkit-optimize-contrast; }'
    iframeDoc.head.appendChild(style)

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 5000,
      })
      const TARGET_PX_WIDTH = 2400
      const smallCanvas = downscaleCanvas(canvas, TARGET_PX_WIDTH)
      const jpegDataUrl = smallCanvas.toDataURL('image/jpeg', 0.92)

      const imgRatio = smallCanvas.height / smallCanvas.width
      let imgW = A4_W
      let imgH = A4_W * imgRatio
      if (imgH > A4_H) {
        imgH = A4_H
        imgW = A4_H / imgRatio
      }
      const xOffset = (A4_W - imgW) / 2

      if (i > 0) pdf.addPage()
      pdf.addImage(jpegDataUrl, 'JPEG', xOffset, 0, imgW, imgH)
    }

    return pdf.output('blob')
  } finally {
    document.body.removeChild(iframe)
  }
}

function downscaleCanvas(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  if (source.width <= targetWidth) return source
  const ratio = targetWidth / source.width
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = Math.round(source.height * ratio)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Fetches the HTML from a URL, converts to PDF, triggers a browser download.
 * Used by ThankYouPage's Download CTA for the "pager" report variant —
 * server-side PDF (BetReportDataController.publicFinalReportPdf) is still
 * used for BET reports where the existing Flying Saucer pipeline holds.
 */
export async function downloadHtmlAsPdf(htmlUrl: string, fileName: string): Promise<void> {
  const res = await fetch(htmlUrl, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to fetch report HTML: ${res.status}`)
  const html = await res.text()
  const blob = await htmlToPdfBlob(html)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
