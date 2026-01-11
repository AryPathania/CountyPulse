import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useResumes,
  useResume,
  useResumeWithBullets,
  useCreateResume,
  useUpdateResume,
  useUpdateResumeContent,
  useDeleteResume,
  useCreateResumeFromDraft,
  resumeKeys,
} from '../../queries/resumes'

// Mock @odie/db functions
const mockGetResumes = vi.fn()
const mockGetResume = vi.fn()
const mockGetResumeWithBullets = vi.fn()
const mockCreateResume = vi.fn()
const mockUpdateResume = vi.fn()
const mockUpdateResumeContent = vi.fn()
const mockDeleteResume = vi.fn()
const mockCreateResumeFromDraft = vi.fn()

vi.mock('@odie/db', () => ({
  getResumes: (...args: unknown[]) => mockGetResumes(...args),
  getResume: (...args: unknown[]) => mockGetResume(...args),
  getResumeWithBullets: (...args: unknown[]) => mockGetResumeWithBullets(...args),
  createResume: (...args: unknown[]) => mockCreateResume(...args),
  updateResume: (...args: unknown[]) => mockUpdateResume(...args),
  updateResumeContent: (...args: unknown[]) => mockUpdateResumeContent(...args),
  deleteResume: (...args: unknown[]) => mockDeleteResume(...args),
  createResumeFromDraft: (...args: unknown[]) => mockCreateResumeFromDraft(...args),
}))

// Test data
const mockResumesList = [
  {
    id: 'resume-1',
    user_id: 'user-123',
    name: 'Software Engineer',
    template_id: 'default',
    content: { sections: [] },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

const mockSingleResume = {
  id: 'resume-1',
  user_id: 'user-123',
  name: 'Software Engineer',
  template_id: 'default',
  content: { sections: [] },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockResumeWithBullets = {
  ...mockSingleResume,
  parsedContent: { sections: [] },
  bullets: [],
  positions: [],
}

// Wrapper component for hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('resume queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resumeKeys', () => {
    it('should generate correct query keys', () => {
      expect(resumeKeys.all).toEqual(['resumes'])
      expect(resumeKeys.lists()).toEqual(['resumes', 'list'])
      expect(resumeKeys.list('user-123')).toEqual(['resumes', 'list', 'user-123'])
      expect(resumeKeys.details()).toEqual(['resumes', 'detail'])
      expect(resumeKeys.detail('resume-1')).toEqual(['resumes', 'detail', 'resume-1'])
      expect(resumeKeys.withBullets('resume-1')).toEqual([
        'resumes',
        'detail',
        'resume-1',
        'bullets',
      ])
    })
  })

  describe('useResumes', () => {
    it('should fetch resumes for a user', async () => {
      mockGetResumes.mockResolvedValue(mockResumesList)

      const { result } = renderHook(() => useResumes('user-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockResumesList)
      expect(mockGetResumes).toHaveBeenCalledWith('user-123')
    })

    it('should not fetch when userId is undefined', () => {
      const { result } = renderHook(() => useResumes(undefined), {
        wrapper: createWrapper(),
      })

      expect(result.current.isFetching).toBe(false)
      expect(mockGetResumes).not.toHaveBeenCalled()
    })
  })

  describe('useResume', () => {
    it('should fetch a single resume', async () => {
      mockGetResume.mockResolvedValue(mockSingleResume)

      const { result } = renderHook(() => useResume('resume-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSingleResume)
      expect(mockGetResume).toHaveBeenCalledWith('resume-1')
    })

    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useResume(undefined), {
        wrapper: createWrapper(),
      })

      expect(result.current.isFetching).toBe(false)
      expect(mockGetResume).not.toHaveBeenCalled()
    })
  })

  describe('useResumeWithBullets', () => {
    it('should fetch resume with bullets', async () => {
      mockGetResumeWithBullets.mockResolvedValue(mockResumeWithBullets)

      const { result } = renderHook(() => useResumeWithBullets('resume-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockResumeWithBullets)
      expect(mockGetResumeWithBullets).toHaveBeenCalledWith('resume-1')
    })
  })

  describe('useCreateResume', () => {
    it('should create a resume', async () => {
      const newResume = { ...mockSingleResume, id: 'new-resume' }
      mockCreateResume.mockResolvedValue(newResume)

      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateResume(), { wrapper })

      result.current.mutate({
        user_id: 'user-123',
        name: 'New Resume',
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCreateResume).toHaveBeenCalledWith({
        user_id: 'user-123',
        name: 'New Resume',
      })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resumeKeys.lists() })
    })
  })

  describe('useUpdateResume', () => {
    it('should update a resume', async () => {
      const updatedResume = { ...mockSingleResume, name: 'Updated Resume' }
      mockUpdateResume.mockResolvedValue(updatedResume)

      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateResume(), { wrapper })

      result.current.mutate({
        resumeId: 'resume-1',
        updates: { name: 'Updated Resume' },
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockUpdateResume).toHaveBeenCalledWith('resume-1', { name: 'Updated Resume' })
      expect(invalidateSpy).toHaveBeenCalled()
    })
  })

  describe('useDeleteResume', () => {
    it('should delete a resume', async () => {
      mockDeleteResume.mockResolvedValue(undefined)

      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useDeleteResume(), { wrapper })

      result.current.mutate('resume-1')

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDeleteResume).toHaveBeenCalledWith('resume-1')
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resumeKeys.lists() })
      expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: resumeKeys.detail('resume-1') })
    })
  })

  describe('useUpdateResumeContent', () => {
    it('should update resume content', async () => {
      const updatedResume = {
        ...mockSingleResume,
        content: { sections: [{ id: 'exp', title: 'Experience', items: [] }] },
      }
      mockUpdateResumeContent.mockResolvedValue(updatedResume)

      const queryClient = new QueryClient()
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateResumeContent(), { wrapper })

      const newContent = { sections: [{ id: 'exp', title: 'Experience', items: [] }] }
      result.current.mutate({
        resumeId: 'resume-1',
        content: newContent,
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockUpdateResumeContent).toHaveBeenCalledWith('resume-1', newContent)
      expect(setQueryDataSpy).toHaveBeenCalledWith(resumeKeys.detail('resume-1'), updatedResume)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: resumeKeys.withBullets('resume-1'),
      })
    })
  })

  describe('useCreateResumeFromDraft', () => {
    it('should create a resume from draft', async () => {
      const newResume = { ...mockSingleResume, id: 'draft-resume' }
      mockCreateResumeFromDraft.mockResolvedValue(newResume)

      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateResumeFromDraft(), { wrapper })

      result.current.mutate({
        userId: 'user-123',
        name: 'Draft Resume',
        bulletIds: ['bullet-1', 'bullet-2'],
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCreateResumeFromDraft).toHaveBeenCalledWith(
        'user-123',
        'Draft Resume',
        ['bullet-1', 'bullet-2']
      )
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resumeKeys.lists() })
      expect(setQueryDataSpy).toHaveBeenCalledWith(resumeKeys.detail('draft-resume'), newResume)
    })
  })
})
