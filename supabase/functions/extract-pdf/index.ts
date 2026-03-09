import { withMiddleware, jsonResponse } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'

withMiddleware(async (req: Request, _ctx: HandlerContext) => {
  const pdfBytes = await req.arrayBuffer()
  console.log('[extract-pdf] Server fallback extraction, bytes:', pdfBytes.byteLength)

  if (!pdfBytes || pdfBytes.byteLength === 0) {
    return jsonResponse({ error: 'PDF file data is required' }, 400)
  }

  const decoder = new TextDecoder('latin1')
  const rawText = decoder.decode(pdfBytes)

  const textChunks: string[] = []

  const btEtRegex = /BT\s([\s\S]*?)ET/g
  let match
  while ((match = btEtRegex.exec(rawText)) !== null) {
    const block = match[1]
    const tjRegex = /\((.*?)\)\s*Tj/g
    let tjMatch
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textChunks.push(tjMatch[1])
    }
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g
    let tjArrayMatch
    while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
      const arrayContent = tjArrayMatch[1]
      const stringRegex = /\((.*?)\)/g
      let strMatch
      while ((strMatch = stringRegex.exec(arrayContent)) !== null) {
        textChunks.push(strMatch[1])
      }
    }
  }

  const extractedText = textChunks
    .join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  console.log('[extract-pdf] Extracted text length:', extractedText.length)

  return jsonResponse({ text: extractedText })
}, { requireOpenAI: false })
