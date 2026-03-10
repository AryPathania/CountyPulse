import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- pdfjs-dist mock setup ---

const mockGlobalWorkerOptions = { workerSrc: '' }
const mockGetDocument = vi.fn()

vi.mock('pdfjs-dist', () => ({
  default: {
    version: '4.0.0',
    GlobalWorkerOptions: mockGlobalWorkerOptions,
    getDocument: (...args: unknown[]) => mockGetDocument(...args),
  },
  version: '4.0.0',
  GlobalWorkerOptions: mockGlobalWorkerOptions,
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}))

// Polyfill File.arrayBuffer for jsdom
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.readAsArrayBuffer(this)
    })
  }
}

// --- Helpers ---

function makePage(items: Array<{ str?: string }>) {
  return {
    getTextContent: vi.fn().mockResolvedValue({ items }),
  }
}

function setupMockPdf(pages: Array<Array<{ str?: string }>>) {
  const pageMap = new Map<number, ReturnType<typeof makePage>>()
  pages.forEach((items, idx) => {
    pageMap.set(idx + 1, makePage(items))
  })

  mockGetDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: vi.fn((i: number) => {
        const page = pageMap.get(i)
        if (!page) throw new Error(`getPage called with unexpected index ${i}`)
        return Promise.resolve(page)
      }),
    }),
  })
}

function makeFile(content = 'fake-pdf-bytes'): File {
  return new File([content], 'test.pdf', { type: 'application/pdf' })
}

// --- Tests ---

describe('extractTextFromPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGlobalWorkerOptions.workerSrc = ''
  })

  it('extracts text from a 3-page PDF (1-indexed pages)', async () => {
    setupMockPdf([
      [{ str: 'Page' }, { str: 'one' }],
      [{ str: 'Page' }, { str: 'two' }],
      [{ str: 'Page' }, { str: 'three' }],
    ])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const result = await extractTextFromPdf(makeFile())

    expect(result).toBe('Page one\n\nPage two\n\nPage three')

    // Verify getPage was called with 1, 2, 3 (1-indexed)
    const getPageFn = (await mockGetDocument.mock.results[0].value.promise).getPage
    expect(getPageFn).toHaveBeenCalledWith(1)
    expect(getPageFn).toHaveBeenCalledWith(2)
    expect(getPageFn).toHaveBeenCalledWith(3)
    expect(getPageFn).toHaveBeenCalledTimes(3)
  })

  it('joins pages with double-newline separator', async () => {
    setupMockPdf([
      [{ str: 'A' }],
      [{ str: 'B' }],
    ])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const result = await extractTextFromPdf(makeFile())

    // Exact separator check: one \n\n between pages, no trailing newlines
    expect(result).toBe('A\n\nB')
    expect(result).not.toContain('\n\n\n')
  })

  it('falls back to empty string when item.str is undefined', async () => {
    setupMockPdf([
      [{ str: 'hello' }, { str: undefined }, { str: 'world' }],
    ])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const result = await extractTextFromPdf(makeFile())

    // undefined str becomes '' so join produces 'hello  world' (two spaces)
    expect(result).toBe('hello  world')
  })

  it('trims leading and trailing whitespace from final output', async () => {
    setupMockPdf([
      [{ str: '  leading' }],
      [{ str: 'trailing  ' }],
    ])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const result = await extractTextFromPdf(makeFile())

    expect(result).toBe('leading\n\ntrailing')
    expect(result).not.toMatch(/^\s/)
    expect(result).not.toMatch(/\s$/)
  })

  it('handles an empty page (0 text items) without error', async () => {
    setupMockPdf([
      [{ str: 'before' }],
      [], // empty page
      [{ str: 'after' }],
    ])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const result = await extractTextFromPdf(makeFile())

    // Empty page contributes '' so we get 'before\n\n\n\nafter'
    expect(result).toBe('before\n\n\n\nafter')
  })

  it('sets workerSrc to the correct jsdelivr CDN URL', async () => {
    setupMockPdf([[{ str: 'x' }]])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    await extractTextFromPdf(makeFile())

    expect(mockGlobalWorkerOptions.workerSrc).toBe(
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.0/build/pdf.worker.min.mjs',
    )
  })

  it('handles a single-page PDF', async () => {
    setupMockPdf([[{ str: 'only page' }]])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const result = await extractTextFromPdf(makeFile())

    expect(result).toBe('only page')
    // No separator when there is only one page
    expect(result).not.toContain('\n\n')
  })

  it('passes the file arrayBuffer data to getDocument', async () => {
    setupMockPdf([[{ str: 'ok' }]])

    const { extractTextFromPdf } = await import('../../lib/pdf-extract')
    const file = makeFile('my-pdf-content')
    await extractTextFromPdf(file)

    expect(mockGetDocument).toHaveBeenCalledTimes(1)
    const callArg = mockGetDocument.mock.calls[0][0]
    expect(callArg).toHaveProperty('data')
    expect(callArg.data).toBeInstanceOf(ArrayBuffer)
  })
})
