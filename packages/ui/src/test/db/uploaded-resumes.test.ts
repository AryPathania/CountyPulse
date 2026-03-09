import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for uploaded-resumes query functions.
 * These test the db layer functions by mocking them directly,
 * following the same pattern as bullets-draft.test.ts.
 */

const mockCreateUploadedResume = vi.fn()
const mockGetUploadedResumeByHash = vi.fn()
const mockGetUploadedResumes = vi.fn()
const mockUploadResumeFile = vi.fn()
const mockUpdateUploadedResumeParsedData = vi.fn()

vi.mock('@odie/db', () => ({
  createUploadedResume: (...args: unknown[]) => mockCreateUploadedResume(...args),
  getUploadedResumeByHash: (...args: unknown[]) => mockGetUploadedResumeByHash(...args),
  getUploadedResumes: (...args: unknown[]) => mockGetUploadedResumes(...args),
  uploadResumeFile: (...args: unknown[]) => mockUploadResumeFile(...args),
  updateUploadedResumeParsedData: (...args: unknown[]) => mockUpdateUploadedResumeParsedData(...args),
}))

describe('uploaded-resumes queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createUploadedResume', () => {
    it('inserts a new resume and returns it', async () => {
      const { createUploadedResume } = await import('@odie/db')

      const newResume = {
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'abc123',
        storage_path: 'user-123/abc123.pdf',
      }

      const createdResume = {
        id: 'resume-1',
        ...newResume,
        extracted_text: null,
        parsed_data: null,
        created_at: '2024-01-15T10:00:00Z',
      }

      mockCreateUploadedResume.mockResolvedValue(createdResume)

      const result = await createUploadedResume(newResume)
      expect(result).toEqual(createdResume)
      expect(mockCreateUploadedResume).toHaveBeenCalledWith(newResume)
    })

    it('throws on insert error', async () => {
      const { createUploadedResume } = await import('@odie/db')

      mockCreateUploadedResume.mockRejectedValue(new Error('Insert failed'))

      await expect(
        createUploadedResume({
          user_id: 'u',
          file_name: 'f',
          file_hash: 'h',
          storage_path: 'p',
        })
      ).rejects.toThrow('Insert failed')
    })

    it('includes optional extracted_text and parsed_data', async () => {
      const { createUploadedResume } = await import('@odie/db')

      const resumeWithOptionals = {
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'hash',
        storage_path: 'path',
        extracted_text: 'Full resume text here',
        parsed_data: { positions: [], skills: { hard: [], soft: [] } },
      }

      const result = {
        id: 'resume-2',
        ...resumeWithOptionals,
        created_at: '2024-01-15T10:00:00Z',
      }

      mockCreateUploadedResume.mockResolvedValue(result)

      const created = await createUploadedResume(resumeWithOptionals)
      expect(created.extracted_text).toBe('Full resume text here')
      expect(created.parsed_data).toBeDefined()
    })
  })

  describe('getUploadedResumeByHash', () => {
    it('returns matching resume for hash', async () => {
      const { getUploadedResumeByHash } = await import('@odie/db')

      const resume = {
        id: 'resume-1',
        user_id: 'user-123',
        file_name: 'resume.pdf',
        file_hash: 'abc123',
        storage_path: 'user-123/abc123.pdf',
        extracted_text: 'text content',
        parsed_data: null,
        created_at: '2024-01-15T10:00:00Z',
      }

      mockGetUploadedResumeByHash.mockResolvedValue(resume)

      const result = await getUploadedResumeByHash('user-123', 'abc123')

      expect(result).toEqual(resume)
      expect(mockGetUploadedResumeByHash).toHaveBeenCalledWith('user-123', 'abc123')
    })

    it('returns null when no match found', async () => {
      const { getUploadedResumeByHash } = await import('@odie/db')

      mockGetUploadedResumeByHash.mockResolvedValue(null)

      const result = await getUploadedResumeByHash('user-123', 'nonexistent')
      expect(result).toBeNull()
    })

    it('throws on query error', async () => {
      const { getUploadedResumeByHash } = await import('@odie/db')

      mockGetUploadedResumeByHash.mockRejectedValue(new Error('Query failed'))

      await expect(
        getUploadedResumeByHash('user-123', 'hash')
      ).rejects.toThrow('Query failed')
    })
  })

  describe('getUploadedResumes', () => {
    it('returns list of resumes for a user ordered by created_at', async () => {
      const { getUploadedResumes } = await import('@odie/db')

      const resumes = [
        {
          id: 'r-1',
          user_id: 'user-123',
          file_name: 'resume1.pdf',
          file_hash: 'h1',
          storage_path: 'p1',
          extracted_text: null,
          parsed_data: null,
          created_at: '2024-01-16T10:00:00Z',
        },
        {
          id: 'r-2',
          user_id: 'user-123',
          file_name: 'resume2.pdf',
          file_hash: 'h2',
          storage_path: 'p2',
          extracted_text: null,
          parsed_data: null,
          created_at: '2024-01-15T10:00:00Z',
        },
      ]

      mockGetUploadedResumes.mockResolvedValue(resumes)

      const result = await getUploadedResumes('user-123')

      expect(result).toEqual(resumes)
      expect(result).toHaveLength(2)
      expect(mockGetUploadedResumes).toHaveBeenCalledWith('user-123')
    })

    it('returns empty array when no resumes found', async () => {
      const { getUploadedResumes } = await import('@odie/db')

      mockGetUploadedResumes.mockResolvedValue([])

      const result = await getUploadedResumes('user-123')
      expect(result).toEqual([])
    })

    it('throws on query error', async () => {
      const { getUploadedResumes } = await import('@odie/db')

      mockGetUploadedResumes.mockRejectedValue(new Error('DB error'))

      await expect(getUploadedResumes('user-123')).rejects.toThrow('DB error')
    })
  })

  describe('uploadResumeFile', () => {
    it('uploads file to storage and returns path', async () => {
      const { uploadResumeFile } = await import('@odie/db')

      const storagePath = 'user-123/abc.pdf'
      mockUploadResumeFile.mockResolvedValue(storagePath)

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' })
      const result = await uploadResumeFile('user-123', file, storagePath)

      expect(result).toBe(storagePath)
      expect(mockUploadResumeFile).toHaveBeenCalledWith('user-123', file, storagePath)
    })

    it('throws on storage upload error', async () => {
      const { uploadResumeFile } = await import('@odie/db')

      mockUploadResumeFile.mockRejectedValue(new Error('Storage full'))

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' })

      await expect(
        uploadResumeFile('user-123', file, 'path')
      ).rejects.toThrow('Storage full')
    })
  })

  describe('updateUploadedResumeParsedData', () => {
    it('updates parsed data for a resume', async () => {
      const { updateUploadedResumeParsedData } = await import('@odie/db')

      mockUpdateUploadedResumeParsedData.mockResolvedValue(undefined)

      const parsedData = { positions: [], skills: { hard: [], soft: [] } }

      await expect(
        updateUploadedResumeParsedData('resume-1', parsedData)
      ).resolves.toBeUndefined()

      expect(mockUpdateUploadedResumeParsedData).toHaveBeenCalledWith('resume-1', parsedData)
    })

    it('throws on update error', async () => {
      const { updateUploadedResumeParsedData } = await import('@odie/db')

      mockUpdateUploadedResumeParsedData.mockRejectedValue(new Error('Update failed'))

      await expect(
        updateUploadedResumeParsedData('resume-1', {})
      ).rejects.toThrow('Update failed')
    })
  })
})
