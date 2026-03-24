import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
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

const storedGapAnalysis = {
  jobTitle: 'Senior Software Engineer',
  company: 'Tech Corp',
  covered: [
    {
      requirement: { description: 'Leadership experience', category: 'soft', importance: 'must_have' as const },
      matchedBullets: [{ id: 'bullet-1', text: 'Led team of 5 engineers', similarity: 0.85 }],
    },
  ],
  gaps: [{ description: 'Cloud experience', category: 'technical', importance: 'must_have' as const }],
  totalRequirements: 2,
  coveredCount: 1,
  analyzedAt: new Date().toISOString(),
  triageDecisions: { 'ybb2hh': 'interview' as const },
  ignoredRequirements: [],
}

// Mock draft data — includes gap_analysis so bullets render immediately
const mockDraft = {
  id: 'draft-123',
  user_id: 'test-user-id',
  job_title: 'Senior Software Engineer',
  company: 'Tech Corp',
  jd_text: 'Looking for an experienced software engineer...',
  retrieved_bullet_ids: ['bullet-1', 'bullet-2'],
  selected_bullet_ids: ['bullet-1'],
  parsed_requirements: null,
  gap_analysis: storedGapAnalysis,
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
const mockCreateResumeFromDraft = vi.fn()
const mockUpdateJobDraftTriageDecisions = vi.fn().mockResolvedValue({})
vi.mock('@odie/db', () => ({
  getJobDraftWithBullets: (...args: unknown[]) => mockGetJobDraftWithBullets(...args),
  createResumeFromDraft: (...args: unknown[]) => mockCreateResumeFromDraft(...args),
  updateJobDraftTriageDecisions: (...args: unknown[]) => mockUpdateJobDraftTriageDecisions(...args),
}))

// Mock jd-processing service (keep buildGapDataFromStored + buildInterviewContextFromGaps real)
const mockProcessJobDescription = vi.fn()
const mockAnalyzeJobDescriptionGaps = vi.fn()
vi.mock('../../services/jd-processing', async () => {
  const actual = await vi.importActual('../../services/jd-processing')
  return {
    ...actual,
    processJobDescription: (...args: unknown[]) => mockProcessJobDescription(...args),
    analyzeJobDescriptionGaps: (...args: unknown[]) => mockAnalyzeJobDescriptionGaps(...args),
  }
})

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderDraftPage(route = '/resumes/draft-123', state?: { jdText?: string }) {
  const testQueryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <Routes>
          <Route path="/resumes/:id" element={<DraftResumePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function renderDraftPageWithQueryClient(
  queryClient: QueryClient,
  route = '/resumes/draft-123',
  state?: { jdText?: string }
) {
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
    mockGetJobDraftWithBullets.mockResolvedValue(mockDraft)
    mockCreateResumeFromDraft.mockResolvedValue({ id: 'resume-456', name: 'Test Resume' })
    // Default: analyzeJobDescriptionGaps never resolves (not needed for most tests)
    mockAnalyzeJobDescriptionGaps.mockReturnValue(new Promise(() => {}))
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
      expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument()
    })

    expect(screen.getByTestId('draft-page')).toBeInTheDocument()
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

  it('should show error state when draft fails to load', async () => {
    mockGetJobDraftWithBullets.mockRejectedValue(new Error('Draft not found'))

    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('draft-error')).toBeInTheDocument()
    })

    expect(screen.getByText('Draft not found')).toBeInTheDocument()
  })

  it('should navigate home on error back button click', async () => {
    mockGetJobDraftWithBullets.mockRejectedValue(new Error('Draft not found'))

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

  it('should create resume and navigate to edit page when create resume clicked', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('create-resume-btn')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('create-resume-btn'))

    await waitFor(() => {
      expect(mockCreateResumeFromDraft).toHaveBeenCalledWith(
        'test-user-id',
        'Senior Software Engineer',
        ['bullet-1', 'bullet-2'],
        { profileEntries: undefined }
      )
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/resumes/resume-456/edit')
    })
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


  it('should show analyzing spinner when gap_analysis is not yet stored', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue({
      ...mockDraft,
      gap_analysis: null,
    })

    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('gap-loading')).toBeInTheDocument()
    })

    expect(screen.getByText('Parsing job description...')).toBeInTheDocument()
  })


  it('should auto-trigger gap analysis when gap_analysis is null', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue({
      ...mockDraft,
      gap_analysis: null,
    })

    renderDraftPage()

    await waitFor(() => {
      expect(mockAnalyzeJobDescriptionGaps).toHaveBeenCalledWith(
        'test-user-id',
        mockDraft.jd_text,
        mockDraft.id,
        undefined,
        expect.any(Function)
      )
    })
  })

  it('should not re-analyze when gap data is fresh', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('bullet-list')).toBeInTheDocument()
    })

    expect(mockAnalyzeJobDescriptionGaps).not.toHaveBeenCalled()
    expect(screen.queryByTestId('gap-loading')).not.toBeInTheDocument()
  })

  it('should re-analyze when bullets cache is newer than analyzedAt', async () => {
    const pastAnalysis = {
      ...storedGapAnalysis,
      analyzedAt: '2020-01-01T00:00:00Z',
    }
    mockGetJobDraftWithBullets.mockResolvedValue({
      ...mockDraft,
      gap_analysis: pastAnalysis,
    })

    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['bullets', 'list'], [])

    renderDraftPageWithQueryClient(queryClient)

    await waitFor(() => {
      expect(mockAnalyzeJobDescriptionGaps).toHaveBeenCalledWith(
        'test-user-id',
        mockDraft.jd_text,
        mockDraft.id,
        undefined,
        expect.any(Function)
      )
    })
  })

  it('should show gap error and allow retry', async () => {
    mockGetJobDraftWithBullets.mockResolvedValue({
      ...mockDraft,
      gap_analysis: null,
    })
    // First call (auto-trigger) rejects; second call (also auto-trigger) hangs;
    // third call will be the manual retry
    mockAnalyzeJobDescriptionGaps
      .mockRejectedValueOnce(new Error('Analysis failed'))
      .mockReturnValue(new Promise(() => {}))

    renderDraftPage()

    // The auto-trigger fires, rejects, briefly shows gap-error,
    // then the effect re-triggers (second call hangs in pending).
    // So gap-loading is shown while the second attempt is pending.
    await waitFor(() => {
      expect(mockAnalyzeJobDescriptionGaps).toHaveBeenCalledTimes(2)
    })

    // Verify the first call was the auto-trigger with correct args
    expect(mockAnalyzeJobDescriptionGaps).toHaveBeenCalledWith(
      'test-user-id',
      mockDraft.jd_text,
      mockDraft.id,
      undefined,
      expect.any(Function)
    )
  })

  it('should render gap analysis component when data is available', async () => {
    renderDraftPage()

    await waitFor(() => {
      expect(screen.getByTestId('gap-analysis')).toBeInTheDocument()
    })

    expect(screen.getByText(/1\/2 requirements covered/)).toBeInTheDocument()
  })
})
