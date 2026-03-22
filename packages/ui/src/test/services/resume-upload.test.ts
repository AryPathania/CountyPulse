import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @odie/db
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
const mockCreateUploadedResume = vi.fn()
const mockGetUploadedResumeByHash = vi.fn()
const mockUploadResumeFile = vi.fn()
const mockCreatePositionWithBullets = vi.fn()
const mockEmbedBullets = vi.fn()
const mockGetProfileEntriesByCategory = vi.fn()
const mockCreateProfileEntries = vi.fn()
const mockEmbedItems = vi.fn()
const mockToEmbeddableText = vi.fn((entry: { title: string; subtitle?: string | null }) => entry.title)

vi.mock('@odie/db', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
  createUploadedResume: (...args: unknown[]) => mockCreateUploadedResume(...args),
  getUploadedResumeByHash: (...args: unknown[]) => mockGetUploadedResumeByHash(...args),
  uploadResumeFile: (...args: unknown[]) => mockUploadResumeFile(...args),
  createPositionWithBullets: (...args: unknown[]) => mockCreatePositionWithBullets(...args),
  embedBullets: (...args: unknown[]) => mockEmbedBullets(...args),
  getProfileEntriesByCategory: (...args: unknown[]) => mockGetProfileEntriesByCategory(...args),
  createProfileEntries: (...args: unknown[]) => mockCreateProfileEntries(...args),
  embedItems: (...args: unknown[]) => mockEmbedItems(...args),
  toEmbeddableText: (...args: unknown[]) => mockToEmbeddableText(...args),
  formatEducationTitle: (edu: { degree?: string | null; field?: string | null; institution: string }) => {
    const title = [edu.degree, edu.field].filter(Boolean).join(' in ') || edu.institution
    const subtitle = edu.degree ? edu.institution : null
    return { title, subtitle }
  },
}))

// Mock pdf-extract module
vi.mock('../../lib/pdf-extract', () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue('This is a long enough text extracted from a PDF file to pass the 50 char minimum threshold for client extraction.'),
}))

// Mock crypto.subtle for file hashing
const mockDigest = vi.fn()
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: (...args: unknown[]) => mockDigest(...args),
    },
  },
  writable: true,
})

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

describe('resume-upload service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default hash result
    mockDigest.mockResolvedValue(new Uint8Array([0xab, 0xcd, 0xef, 0x12]).buffer)
    // Default profile entries mocks
    mockGetProfileEntriesByCategory.mockResolvedValue([])
    mockCreateProfileEntries.mockResolvedValue([])
    mockEmbedItems.mockResolvedValue(undefined)
  })

  const validParsedData = {
    positions: [
      {
        company: 'Acme Corp',
        title: 'Software Engineer',
        location: 'SF',
        startDate: '2020-01',
        endDate: '2023-01',
        bullets: [
          {
            originalText: 'Led migration of legacy systems to modern architecture',
            classification: 'strong',
            category: 'Backend',
            hardSkills: ['Microservices'],
            softSkills: ['Leadership'],
          },
          {
            originalText: 'Did some backend work',
            classification: 'fixable',
            fixedText: 'Redesigned backend APIs reducing latency by 40%',
            category: 'Backend',
            hardSkills: ['REST'],
            softSkills: [],
          },
          {
            originalText: 'Helped with stuff',
            classification: 'weak',
            suggestedQuestion: 'Can you describe what you helped with specifically?',
            hardSkills: [],
            softSkills: [],
          },
        ],
      },
    ],
    skills: { hard: ['TypeScript', 'React'], soft: ['Leadership'] },
    education: [{ institution: 'MIT', degree: 'BS', field: 'CS' }],
    summary: 'Experienced engineer',
  }

  function createMockFile(name = 'resume.pdf', size = 1024) {
    const content = new Array(size).fill('a').join('')
    return new File([content], name, { type: 'application/pdf' })
  }

  describe('uploadAndParseResume', () => {
    it('rejects files over 10MB', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      // Create a file that exceeds 10MB
      const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', {
        type: 'application/pdf',
      })

      await expect(uploadAndParseResume('user-123', bigFile)).rejects.toThrow('File must be under 10MB')
    })

    it('returns cached result when dedup hash matches', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue({
        id: 'existing-resume-1',
        parsed_data: validParsedData,
      })

      const file = createMockFile()
      const result = await uploadAndParseResume('user-123', file)

      expect(result.uploadedResumeId).toBe('existing-resume-1')
      expect(result.parsedData).toBeDefined()
      expect(result.context.mode).toBe('resume')
      // Should not upload or parse again
      expect(mockUploadResumeFile).not.toHaveBeenCalled()
      expect(mockFunctionsInvoke).not.toHaveBeenCalled()
    })

    it('completes full upload flow for new resume', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      // No existing resume
      mockGetUploadedResumeByHash.mockResolvedValue(null)
      // Auth session
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      // Upload succeeds
      mockUploadResumeFile.mockResolvedValue('user-123/hash.pdf')
      // LLM parse
      mockFunctionsInvoke.mockResolvedValue({
        data: validParsedData,
        error: null,
      })
      // Create DB record
      mockCreateUploadedResume.mockResolvedValue({
        id: 'new-resume-1',
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'abcdef12',
        storage_path: 'user-123/abcdef12.pdf',
        extracted_text: 'text',
        parsed_data: validParsedData,
        created_at: '2024-01-15T10:00:00Z',
      })
      // Position creation
      mockCreatePositionWithBullets.mockResolvedValue({ bulletIds: ['b1', 'b2'] })
      mockEmbedBullets.mockResolvedValue(undefined)

      const file = createMockFile()
      const result = await uploadAndParseResume('user-123', file)

      expect(result.uploadedResumeId).toBe('new-resume-1')
      expect(result.stats.strongBullets).toBe(1)
      expect(result.stats.fixableBullets).toBe(1)
      expect(result.stats.weakBullets).toBe(1)
      expect(result.stats.positions).toBe(1)
      expect(result.context.mode).toBe('resume')
    })

    it('throws when not authenticated during LLM parse', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({ data: { session: null } })
      mockUploadResumeFile.mockResolvedValue('path')

      const file = createMockFile()

      await expect(uploadAndParseResume('user-123', file)).rejects.toThrow('Not authenticated')
    })

    it('throws on invalid parse response from LLM', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      mockUploadResumeFile.mockResolvedValue('path')
      // Return invalid data (missing required fields)
      mockFunctionsInvoke.mockResolvedValue({
        data: { invalid: true },
        error: null,
      })

      const file = createMockFile()

      await expect(uploadAndParseResume('user-123', file)).rejects.toThrow(
        'Invalid response format from resume parser'
      )
    })

    it('throws when LLM parse function returns error', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      mockUploadResumeFile.mockResolvedValue('path')
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'LLM error' },
      })

      const file = createMockFile()

      await expect(uploadAndParseResume('user-123', file)).rejects.toThrow('LLM error')
    })

    it('builds correct InterviewContext from parsed data', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue({
        id: 'cached-resume',
        parsed_data: validParsedData,
      })

      const file = createMockFile()
      const result = await uploadAndParseResume('user-123', file)

      expect(result.context.mode).toBe('resume')
      if (result.context.mode === 'resume') {
        // Strong bullets include strong + fixable (usable bullets)
        expect(result.context.strongBullets).toHaveLength(2)
        // Fixable bullet should use fixedText
        expect(result.context.strongBullets[1].text).toBe(
          'Redesigned backend APIs reducing latency by 40%'
        )
        // Weak bullets with suggestedQuestion
        expect(result.context.weakBullets).toHaveLength(1)
        expect(result.context.weakBullets[0].originalText).toBe('Helped with stuff')
        // Positions
        expect(result.context.positions).toHaveLength(1)
        expect(result.context.positions[0].company).toBe('Acme Corp')
        // Skills
        expect(result.context.skills.hard).toContain('TypeScript')
        // Education
        expect(result.context.education).toHaveLength(1)
        expect(result.context.education[0].institution).toBe('MIT')
      }
    })

    it('falls back to server-side extraction when client extraction returns short text', async () => {
      // Import the module so we can change the extractTextFromPdf return value
      const pdfExtract = await import('../../lib/pdf-extract')
      vi.mocked(pdfExtract.extractTextFromPdf).mockResolvedValueOnce('short') // < 50 chars

      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      // Server-side extraction: first getSession call for extract-pdf
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      // extract-pdf returns text, then parse-resume also needs session
      mockFunctionsInvoke
        .mockResolvedValueOnce({ data: { text: 'This is the server-side extracted text that is long enough for parsing' }, error: null })
        .mockResolvedValueOnce({ data: validParsedData, error: null })
      mockUploadResumeFile.mockResolvedValue('path')
      mockCreateUploadedResume.mockResolvedValue({
        id: 'server-extract-resume',
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'abcdef12',
        storage_path: 'path',
        extracted_text: 'text',
        parsed_data: validParsedData,
        created_at: '2024-01-15T10:00:00Z',
      })
      mockCreatePositionWithBullets.mockResolvedValue({ bulletIds: ['b1'] })
      mockEmbedBullets.mockResolvedValue(undefined)

      const file = createMockFile()
      const result = await uploadAndParseResume('user-123', file)

      // First functions invoke should be extract-pdf
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('extract-pdf', expect.any(Object))
      expect(result.uploadedResumeId).toBe('server-extract-resume')
    })

    it('falls back to server-side extraction when client extraction throws', async () => {
      const pdfExtract = await import('../../lib/pdf-extract')
      vi.mocked(pdfExtract.extractTextFromPdf).mockRejectedValueOnce(new Error('pdfjs error'))

      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      mockFunctionsInvoke
        .mockResolvedValueOnce({ data: { text: 'Sufficient server-extracted PDF text content here for parsing purposes' }, error: null })
        .mockResolvedValueOnce({ data: validParsedData, error: null })
      mockUploadResumeFile.mockResolvedValue('path')
      mockCreateUploadedResume.mockResolvedValue({
        id: 'fallback-resume',
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'abcdef12',
        storage_path: 'path',
        extracted_text: 'text',
        parsed_data: validParsedData,
        created_at: '2024-01-15T10:00:00Z',
      })
      mockCreatePositionWithBullets.mockResolvedValue({ bulletIds: ['b1'] })
      mockEmbedBullets.mockResolvedValue(undefined)

      const file = createMockFile()
      const result = await uploadAndParseResume('user-123', file)

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('extract-pdf', expect.any(Object))
      expect(result.uploadedResumeId).toBe('fallback-resume')
    })

    it('throws when extracted text is too short (< 10 chars)', async () => {
      const pdfExtract = await import('../../lib/pdf-extract')
      // Return very short text from client side (< 50 chars, triggers server fallback)
      vi.mocked(pdfExtract.extractTextFromPdf).mockResolvedValueOnce('tiny')

      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      // Server-side also returns empty text → triggers the < 10 check
      mockFunctionsInvoke.mockResolvedValueOnce({ data: { text: '' }, error: null })

      const file = createMockFile()

      await expect(uploadAndParseResume('user-123', file)).rejects.toThrow(
        'Could not extract text from PDF. Please try a different file.'
      )
    })

    it('throws when server-side extraction returns an error', async () => {
      const pdfExtract = await import('../../lib/pdf-extract')
      vi.mocked(pdfExtract.extractTextFromPdf).mockResolvedValueOnce('short')

      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      // extract-pdf returns an error
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Server PDF extraction failed' },
      })

      const file = createMockFile()

      await expect(uploadAndParseResume('user-123', file)).rejects.toThrow('Server PDF extraction failed')
    })

    it('creates position with only strong and fixable bullets', async () => {
      const { uploadAndParseResume } = await import('../../services/resume-upload')

      mockGetUploadedResumeByHash.mockResolvedValue(null)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      })
      mockUploadResumeFile.mockResolvedValue('path')
      mockFunctionsInvoke.mockResolvedValue({
        data: validParsedData,
        error: null,
      })
      mockCreateUploadedResume.mockResolvedValue({
        id: 'new-resume',
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'hash',
        storage_path: 'path',
        extracted_text: 'text',
        parsed_data: validParsedData,
        created_at: '2024-01-15T10:00:00Z',
      })
      mockCreatePositionWithBullets.mockResolvedValue({ bulletIds: ['b1', 'b2'] })
      mockEmbedBullets.mockResolvedValue(undefined)

      const file = createMockFile()
      await uploadAndParseResume('user-123', file)

      // Should create position with only 2 bullets (strong + fixable, not weak)
      expect(mockCreatePositionWithBullets).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          company: 'Acme Corp',
          title: 'Software Engineer',
        }),
        expect.arrayContaining([
          expect.objectContaining({
            original_text: 'Led migration of legacy systems to modern architecture',
            current_text: 'Led migration of legacy systems to modern architecture',
          }),
          expect.objectContaining({
            original_text: 'Did some backend work',
            current_text: 'Redesigned backend APIs reducing latency by 40%',
          }),
        ])
      )
    })
  })
})
