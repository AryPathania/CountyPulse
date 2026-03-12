import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ResumesPage } from '../../pages/ResumesPage'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useAuth
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

// Mock @odie/db - data must be inside factory due to hoisting
const mockGetJobDrafts = vi.fn().mockResolvedValue([
  {
    id: 'mock-draft-1',
    user_id: 'test-user-id',
    job_title: 'Software Engineer',
    company: 'Tech Corp',
    jd_text: 'Looking for a skilled software engineer...',
    retrieved_bullet_ids: ['bullet-1', 'bullet-2'],
    selected_bullet_ids: ['bullet-1'],
    created_at: '2024-01-15T00:00:00Z',
    gap_analysis: null,
  },
])
const mockGetUploadedResumes = vi.fn().mockResolvedValue([])
const mockDeleteJobDraft = vi.fn().mockResolvedValue(undefined)

vi.mock('@odie/db', () => ({
  getJobDrafts: (...args: unknown[]) => mockGetJobDrafts(...args),
  getUploadedResumes: (...args: unknown[]) => mockGetUploadedResumes(...args),
  deleteJobDraft: (...args: unknown[]) => mockDeleteJobDraft(...args),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderResumesPage() {
  const testQueryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={testQueryClient}>
      <BrowserRouter>
        <ResumesPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('ResumesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetJobDrafts.mockResolvedValue([
      {
        id: 'mock-draft-1',
        user_id: 'test-user-id',
        job_title: 'Software Engineer',
        company: 'Tech Corp',
        jd_text: 'Looking for a skilled software engineer...',
        retrieved_bullet_ids: ['bullet-1', 'bullet-2'],
        selected_bullet_ids: ['bullet-1'],
        created_at: '2024-01-15T00:00:00Z',
        gap_analysis: null,
      },
    ])
    mockGetUploadedResumes.mockResolvedValue([])
  })

  it('should render resumes page', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('resumes-page')).toBeInTheDocument()
    })
  })

  it('should display page title', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByText('Your Resumes')).toBeInTheDocument()
    })
  })

  it('should have new resume button', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('new-resume-btn')).toBeInTheDocument()
    })
  })

  it('should navigate to home when new resume button is clicked', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('new-resume-btn')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('new-resume-btn'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should show loading state initially', () => {
    renderResumesPage()

    // Loading state appears briefly
    expect(screen.getByTestId('resumes-loading')).toBeInTheDocument()
  })

  it('should display resume list after loading', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('resumes-list')).toBeInTheDocument()
    })
  })

  it('should show Drafts section title', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('drafts-section')).toBeInTheDocument()
    })

    expect(screen.getByTestId('drafts-section')).toHaveTextContent('Drafts')
  })

  it('should show Draft badge on draft cards', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('drafts-section')).toBeInTheDocument()
    })

    const badges = screen.getAllByTestId('draft-badge')
    expect(badges.length).toBeGreaterThan(0)
    expect(badges[0]).toHaveTextContent('Draft')
  })

  it('should show JD preview for drafts without job_title', async () => {
    const jdText = 'We are looking for a senior software engineer with extensive experience in distributed systems...'
    mockGetJobDrafts.mockResolvedValue([
      {
        id: 'mock-draft-2',
        user_id: 'test-user-id',
        job_title: null,
        company: null,
        jd_text: jdText,
        retrieved_bullet_ids: [],
        selected_bullet_ids: [],
        created_at: '2024-01-15T00:00:00Z',
        gap_analysis: null,
      },
    ])

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('drafts-section')).toBeInTheDocument()
    })

    const truncated = jdText.slice(0, 60) + '...'
    expect(screen.getByText(truncated)).toBeInTheDocument()
  })

  it('should show Untitled Draft when no job_title or jd_text', async () => {
    mockGetJobDrafts.mockResolvedValue([
      {
        id: 'mock-draft-3',
        user_id: 'test-user-id',
        job_title: null,
        company: null,
        jd_text: null,
        retrieved_bullet_ids: [],
        selected_bullet_ids: [],
        created_at: '2024-01-15T00:00:00Z',
        gap_analysis: null,
      },
    ])

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('drafts-section')).toBeInTheDocument()
    })

    expect(screen.getByText('Untitled Draft')).toBeInTheDocument()
  })

  it('should show gap_analysis jobTitle when job_title is a URL', async () => {
    mockGetJobDrafts.mockResolvedValue([
      {
        id: 'mock-draft-url',
        user_id: 'test-user-id',
        job_title: 'https://job-boards.greenhouse.io/company/jobs/123',
        company: null,
        jd_text: 'Some JD text',
        retrieved_bullet_ids: [],
        selected_bullet_ids: [],
        created_at: '2024-01-15T00:00:00Z',
        gap_analysis: { jobTitle: 'Software Engineer', company: 'Tech Corp' },
      },
    ])

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('drafts-section')).toBeInTheDocument()
    })

    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.queryByText('https://job-boards.greenhouse.io/company/jobs/123')).not.toBeInTheDocument()
  })

  it('should show more specific timestamp with time', async () => {
    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('drafts-section')).toBeInTheDocument()
    })

    const expectedDate = new Date('2024-01-15T00:00:00Z').toLocaleString()
    expect(screen.getByText(expectedDate)).toBeInTheDocument()
  })

  it('should delete draft when delete button clicked and confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('delete-draft-mock-draft-1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('delete-draft-mock-draft-1'))

    expect(window.confirm).toHaveBeenCalledWith('Delete this draft?')
    expect(mockDeleteJobDraft).toHaveBeenCalledWith('mock-draft-1')
  })

  it('should not delete draft when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('delete-draft-mock-draft-1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('delete-draft-mock-draft-1'))

    expect(window.confirm).toHaveBeenCalledWith('Delete this draft?')
    expect(mockDeleteJobDraft).not.toHaveBeenCalled()
  })

  it('should show error state when data fetch fails', async () => {
    mockGetJobDrafts.mockRejectedValue(new Error('Network error'))

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('resumes-error')).toBeInTheDocument()
    })

    expect(screen.getByTestId('resumes-error')).toHaveTextContent('Network error')
  })

  it('should show empty state when no drafts or uploaded resumes exist', async () => {
    mockGetJobDrafts.mockResolvedValue([])
    mockGetUploadedResumes.mockResolvedValue([])

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('resumes-empty')).toBeInTheDocument()
    })

    expect(screen.getByText('No resumes yet. Paste a job description to get started!')).toBeInTheDocument()
  })

  it('should navigate to home when Create Your First Resume is clicked in empty state', async () => {
    mockGetJobDrafts.mockResolvedValue([])
    mockGetUploadedResumes.mockResolvedValue([])

    renderResumesPage()

    await waitFor(() => {
      expect(screen.getByTestId('resumes-empty')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Create Your First Resume'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  describe('Uploaded Resumes section', () => {
    // Valid parsed_data that passes ResumeContextSchema when spread with mode:'resume'
    const validParsedData = {
      strongBullets: [
        {
          text: 'Led a team of 5 engineers to deliver project 2 weeks ahead of schedule',
          category: 'Leadership',
          hardSkills: ['project management'],
          softSkills: ['leadership'],
          metrics: { value: '2 weeks', type: 'time savings' },
        },
      ],
      weakBullets: [
        {
          originalText: 'Worked on backend stuff',
          suggestedQuestion: 'What specific backend technologies did you use and what was the impact?',
        },
      ],
      positions: [
        {
          company: 'Acme Corp',
          title: 'Senior Engineer',
          location: 'Remote',
          startDate: '2022-01',
          endDate: '2024-06',
        },
      ],
      skills: {
        hard: ['TypeScript', 'React'],
        soft: ['Communication'],
      },
      education: [
        {
          institution: 'MIT',
          degree: 'BS',
          field: 'Computer Science',
          graduationDate: '2020-05',
        },
      ],
    }

    const mockUploadedResume = {
      id: 'upload-1',
      user_id: 'test-user-id',
      file_name: 'my-resume.pdf',
      file_hash: 'abc123',
      storage_path: 'resumes/my-resume.pdf',
      parsed_data: validParsedData,
      created_at: '2024-03-20T10:00:00Z',
    }

    it('should NOT render Uploaded Resumes section when getUploadedResumes returns empty array', async () => {
      mockGetUploadedResumes.mockResolvedValueOnce([])

      renderResumesPage()

      await waitFor(() => {
        expect(screen.getByTestId('resumes-list')).toBeInTheDocument()
      })

      expect(screen.queryByText('Uploaded Resumes')).not.toBeInTheDocument()
      expect(screen.queryByTestId('uploaded-resumes-section')).not.toBeInTheDocument()
    })

    it('should render Uploaded Resumes section with file name and formatted date when data exists', async () => {
      mockGetUploadedResumes.mockResolvedValueOnce([mockUploadedResume])

      renderResumesPage()

      await waitFor(() => {
        expect(screen.getByTestId('uploaded-resumes-section')).toBeInTheDocument()
      })

      expect(screen.getByText('Uploaded Resumes')).toBeInTheDocument()
      expect(screen.getByText('my-resume.pdf')).toBeInTheDocument()
      // Verify date is formatted (toLocaleDateString output)
      const expectedDate = new Date('2024-03-20T10:00:00Z').toLocaleDateString()
      expect(screen.getByText(expectedDate)).toBeInTheDocument()
    })

    it('should render Start Interview button when parsed_data passes ResumeContextSchema', async () => {
      mockGetUploadedResumes.mockResolvedValueOnce([mockUploadedResume])

      renderResumesPage()

      await waitFor(() => {
        expect(screen.getByTestId('uploaded-resumes-section')).toBeInTheDocument()
      })

      expect(screen.getByText('Start Interview')).toBeInTheDocument()
    })

    it('should NOT render Start Interview button when parsed_data is null', async () => {
      mockGetUploadedResumes.mockResolvedValueOnce([
        { ...mockUploadedResume, parsed_data: null },
      ])

      renderResumesPage()

      await waitFor(() => {
        expect(screen.getByTestId('uploaded-resumes-section')).toBeInTheDocument()
      })

      expect(screen.queryByText('Start Interview')).not.toBeInTheDocument()
    })

    it('should NOT render Start Interview button when parsed_data fails schema validation', async () => {
      // Invalid data: missing required fields like positions, skills
      const invalidParsedData = {
        strongBullets: [],
        weakBullets: [],
        // positions missing
        // skills missing
      }

      mockGetUploadedResumes.mockResolvedValueOnce([
        { ...mockUploadedResume, parsed_data: invalidParsedData },
      ])

      renderResumesPage()

      await waitFor(() => {
        expect(screen.getByTestId('uploaded-resumes-section')).toBeInTheDocument()
      })

      expect(screen.queryByText('Start Interview')).not.toBeInTheDocument()
    })

    it('should navigate to /interview with interviewContext when Start Interview is clicked', async () => {
      mockGetUploadedResumes.mockResolvedValueOnce([mockUploadedResume])

      renderResumesPage()

      await waitFor(() => {
        expect(screen.getByText('Start Interview')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Start Interview'))

      expect(mockNavigate).toHaveBeenCalledWith('/interview', {
        state: {
          interviewContext: {
            mode: 'resume',
            ...validParsedData,
          },
        },
      })
    })
  })
})
