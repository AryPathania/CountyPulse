/**
 * Client-side PDF text extraction using pdfjs-dist.
 *
 * This is a dynamic import target — the resume-upload service imports
 * this module lazily so the main bundle is not affected if pdfjs-dist
 * is not installed.
 */

/**
 * Extract text from a PDF file using pdfjs-dist.
 * Returns concatenated text from all pages.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  // Dynamic import to keep pdfjs-dist out of the main bundle
  const pdfjsLib = await import('pdfjs-dist')

  // Set worker source (required by pdfjs-dist)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n\n').trim()
}
