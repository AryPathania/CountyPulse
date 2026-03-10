import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
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
  },
])
const mockGetUploadedResumes = vi.fn().mockResolvedValue([])

vi.mock('@odie/db', () => ({
  getJobDrafts: (...args: unknown[]) => mockGetJobDrafts(...args),
  getUploadedResumes: (...args: unknown[]) => mockGetUploadedResumes(...args),
}))

function renderResumesPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ResumesPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('ResumesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
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
