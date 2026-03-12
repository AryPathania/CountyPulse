import { withMiddleware, jsonResponse } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2MB
const FETCH_TIMEOUT_MS = 10_000

// SSRF protection: block private/loopback hostnames
function isPrivateHostname(hostname: string): boolean {
  if (hostname === 'localhost') return true

  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4) {
    const [, a, b] = ipv4.map(Number)
    if (a === 10) return true                         // 10.0.0.0/8
    if (a === 127) return true                        // 127.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12
    if (a === 192 && b === 168) return true            // 192.168.0.0/16
    if (a === 169 && b === 254) return true            // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 0) return true                          // 0.0.0.0/8
  }

  // IPv6 loopback and link-local
  if (hostname === '::1' || hostname.startsWith('fe80:')) return true

  return false
}

withMiddleware(async (req: Request, _ctx: HandlerContext) => {
  const body = await req.json().catch(() => ({}))
  const { url } = body as { url?: string }

  if (!url || typeof url !== 'string') {
    return jsonResponse({ error: 'url is required' }, 400)
  }

  // Scheme check
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return jsonResponse({ error: 'Invalid URL' }, 400)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return jsonResponse({ error: 'Only http and https URLs are supported' }, 400)
  }

  // SSRF: block private hostnames
  if (isPrivateHostname(parsed.hostname)) {
    return jsonResponse({ error: 'URL points to a private or internal address' }, 400)
  }

  // Fetch with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out. Please paste the job description text directly.'
      : 'Failed to fetch URL. Please paste the job description text directly.'
    return jsonResponse({ error: msg }, 400)
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    return jsonResponse(
      { error: `Could not access this URL (${res.status}). Please paste the job description text directly.` },
      400,
    )
  }

  // Content-type check
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    return jsonResponse(
      { error: 'URL does not point to a web page. Please paste the job description text directly.' },
      400,
    )
  }

  // Size-limited read
  const reader = res.body?.getReader()
  if (!reader) {
    return jsonResponse({ error: 'Could not read response' }, 400)
  }

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel()
      break
    }
    chunks.push(value)
  }

  const html = new TextDecoder().decode(
    chunks.reduce((acc, chunk) => {
      const merged = new Uint8Array(acc.length + chunk.length)
      merged.set(acc)
      merged.set(chunk, acc.length)
      return merged
    }, new Uint8Array(0)),
  )

  // Strip HTML: remove scripts, styles, comments, then all tags; decode entities
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length < 100) {
    return jsonResponse(
      { error: 'Could not extract text from this URL. Please paste the job description text directly.' },
      400,
    )
  }

  // Truncate to a reasonable size for the LLM (50k chars covers any real JD)
  const truncated = text.length > 50_000 ? text.slice(0, 50_000) : text

  return jsonResponse({ text: truncated })
}, { requireOpenAI: false })
