import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { DraftResumePage } from '../../pages/DraftResumePage'

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

// Mock draft data
const mockDraft = {
  id: 'draft-123',
  user_id: 'test-user-id',
  job_title: 'Senior Software Engineer',
  company: 'Tech Corp',
  jd_text: 'Looking for an experienced software engineer...',
  retrieved_bullet_ids: ['bullet-1', 'bullet-2'],
  selected_bullet_ids: ['bullet-1'],
  created_at: '2024-01-15T00:00:00Z',
  bullets: [
    {
      id: 'bullet-1',
      current_text: 'Led team of 5 engineers',
      category: 'Leadership',
      position: { company: 'Previous Corp', title: 'Team Lead' },
    },
    {
      id: 'bullet-2',
      current_text: 'Reduced latency by 40%',
      category: 'Backend',
      position: { company: 'Previous Corp', title: 'Team Lead' },
    },
  ],
}

// Mock @odie/db
const mockGetJobDraftWithBullets = vi.fn()
vi.mock('@odie/db', () => ({
  getJobDraftWithBullets: (...args: unknown[]) => mockGetJobDraftWithBullets(...args),
}))

// Mock jd-processing service
const mockProcessJobDescription = vi.fn()
vi.mock('../../services/jd-processing', () => ({
  processJobDescription: (...args: unknown[]) => mockProcessJobDescription(...args),
}))

function renderDraftPage(route = '/resumes/draft-123', state?: { jdText?: string }) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <Routes>
          <Route path="/resumes/:id" element={<DraftResumePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DraftResumePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    mockGetJobDraftWithBullets.mockResolvedValue(mockDraft)
  })

  it('should show loading state initially', () => {
    // Make the promise never resolve to keep loading state
    mockGetJobDraftWithBullets.mockReturnValue(new Promise(() => {}))

    renderDraftPage()

    expect(screen.getByTestId('draft-loading')).toBeInTheDocument()
    expect(screen.getByText('Finding your best bullets...')).toBeInTheDocument()
  })

  it('should display existing draft when loaded', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('draft-page')).toBeInTheDocument()
    })

    expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    expect(screen.getByText('Matched Bullets (2)')).toBeInTheDocument()
  })

  it('should display bullets list', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('bullet-list')).toBeInTheDocument()
    })

    expect(screen.getByText('Led team of 5 engineers')).toBeInTheDocument()
    expect(screen.getByText('Reduced latency by 40%')).toBeInTheDocument()
  })

  it('should display bullet categories', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('bullet-list')).toBeInTheDocument()
    })

    expect(screen.getByText('Leadership')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
  })

  it('should display position info for bullets', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('bullet-list')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Previous Corp - Team Lead')).toHaveLength(2)
  })

  it('should display job description text', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('jd-text')).toBeInTheDocument()
    })

    expect(screen.getByText('Looking for an experienced software engineer...')).toBeInTheDocument()
  })

  it('should show error state when draft not found', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue(null)

    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('draft-error')).toBeInTheDocument()
    })

    expect(screen.getByText('Draft not found')).toBeInTheDocument()
  })

  it('should navigate home on error back button click', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue(null)

    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('draft-error')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Back to Home'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should have create resume button', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('create-resume-btn')).toBeInTheDocument()
    })
  })

  it('should navigate to edit page when create resume clicked', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('create-resume-btn')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('create-resume-btn'))

    expect(mockNavigate).toHaveBeenCalledWith('/resumes/draft-123/edit')
  })

  it('should show empty state when no bullets matched', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue({
      ...mockDraft,
      bullets: [],
    })

    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('no-bullets')).toBeInTheDocument()
    })

    expect(screen.getByText('No matching bullets found.')).toBeInTheDocument()
  })

  it('should navigate to interview from empty state', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue({
      ...mockDraft,
      bullets: [],
    })

    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('no-bullets')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Start Interview to Add Bullets'))

    expect(mockNavigate).toHaveBeenCalledWith('/interview')
  })

  it('should process JD text when navigating with state', async () => {
    mockProcessJobDescription.mockResolvedValue({
      draftId: 'new-draft-123',
      matchedBulletIds: ['bullet-1'],
    })

    renderDraftPage('/resumes/draft', { jdText: 'New job description text' })

    await waitFor(() => {
      expect(mockProcessJobDescription).toHaveBeenCalledWith(
        'test-user-id',
        'New job description text'
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith('/resumes/new-draft-123', { replace: true })
  })

  it('should show error when no JD text provided for new draft', async () => {
    renderDraftPage('/resumes/draft', {})

    await waitFor(() => {
      expect(screen.getByTestId('draft-error')).toBeInTheDocument()
    })

    expect(screen.getByText('No job description provided')).toBeInTheDocument()
  })
})
