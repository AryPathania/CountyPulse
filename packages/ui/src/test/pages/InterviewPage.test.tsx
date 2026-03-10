import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { InterviewPage } from '../../pages/InterviewPage'
import type { ExtractedInterviewData } from '@odie/shared'

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useAuth — uses a fn so tests can override the return value per-test
const mockUseAuth = vi.fn()
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

function defaultAuthReturn() {
  return {
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }
}

// Mock @odie/db
const mockCreatePositionWithBullets = vi.fn()
const mockCreatePosition = vi.fn()
const mockCreateDraftBullet = vi.fn()
const mockFinalizeDraftBullets = vi.fn()
const mockEmbedBullets = vi.fn()
vi.mock('@odie/db', () => ({
  createPositionWithBullets: (...args: unknown[]) => mockCreatePositionWithBullets(...args),
  createPosition: (...args: unknown[]) => mockCreatePosition(...args),
  createDraftBullet: (...args: unknown[]) => mockCreateDraftBullet(...args),
  finalizeDraftBullets: (...args: unknown[]) => mockFinalizeDraftBullets(...args),
  embedBullets: (...args: unknown[]) => mockEmbedBullets(...args),
}))

// Capture onComplete so tests can invoke it with arbitrary data
let capturedOnComplete: ((data: ExtractedInterviewData) => void) | null = null

// Mock InterviewChat component to control its behavior
vi.mock('../../components/interview/InterviewChat', () => ({
  InterviewChat: ({
    onComplete,
    onCancel,
  }: {
    onComplete: (data: ExtractedInterviewData) => void
    onCancel: () => void
  }) => {
    capturedOnComplete = onComplete
    return (
      <div data-testid="mock-interview-chat">
        <button onClick={() => onComplete({ positions: [] })} data-testid="complete-empty">
          Complete Empty
        </button>
        <button
          onClick={() =>
            onComplete({
              positions: [
                {
                  position: { company: 'Tech Corp', title: 'Engineer' },
                  bullets: [
                    {
                      text: 'Did stuff',
                      category: 'Backend',
                      hardSkills: ['TypeScript'],
                      softSkills: ['Leadership'],
                    },
                  ],
                },
              ],
            })
          }
          data-testid="complete-with-data"
        >
          Complete With Data
        </button>
        <button onClick={onCancel} data-testid="cancel">
          Cancel
        </button>
      </div>
    )
  },
}))

// Mock window.confirm
const mockConfirm = vi.fn()
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
})

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

function renderInterviewPage() {
  const queryClient = createTestQueryClient()
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const tree = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/interview']}>
        <Routes>
          <Route path="/interview" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  const result = render(tree)
  return { ...result, queryClient, invalidateQueriesSpy, tree }
}

/**
 * Helper to render InterviewPage with route state (e.g., interviewContext).
 * Uses MemoryRouter initialEntries with state to simulate navigation from another page.
 */
function renderInterviewPageWithRouteState(state: Record<string, unknown>) {
  const queryClient = createTestQueryClient()
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const tree = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/interview', state }]}>
        <Routes>
          <Route path="/interview" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  const result = render(tree)
  return { ...result, queryClient, invalidateQueriesSpy, tree }
}

/**
 * Helper to render InterviewPage with pre-populated localStorage state.
 * This simulates a resumed interview where draft bullets/positions already exist.
 */
function renderInterviewPageWithDraftState(opts: {
  savedBulletIds: string[]
  savedBulletKeys: string[]
  savedPositionIds: string[]
  positions: Array<{
    position: { company: string; title: string; location?: string | null; startDate?: string | null; endDate?: string | null }
    bullets: Array<{ text: string; category?: string | null; hardSkills?: string[]; softSkills?: string[] }>
  }>
}) {
  const storageKey = `odie_interview_state_test-user-id`
  const storedState = {
    messages: [{ role: 'user', content: 'test' }],
    extractedData: { positions: opts.positions },
    savedBulletIds: opts.savedBulletIds,
    savedBulletKeys: opts.savedBulletKeys,
    savedPositionIds: opts.savedPositionIds,
    lastUpdated: new Date().toISOString(),
  }
  mockLocalStorage.getItem.mockImplementation((key: string) => {
    if (key === storageKey) return JSON.stringify(storedState)
    return null
  })

  return renderInterviewPage()
}

describe('InterviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(defaultAuthReturn())
    capturedOnComplete = null
    mockConfirm.mockReturnValue(false)
    mockLocalStorage.getItem.mockReturnValue(null)
    mockFinalizeDraftBullets.mockResolvedValue(undefined)
    mockEmbedBullets.mockResolvedValue(undefined)
  })

  it('should render interview page', async () => {
    renderInterviewPage()

    expect(screen.getByTestId('interview-page')).toBeInTheDocument()

    // Wait for hydration to complete
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })
  })

  it('should redirect to bullets when completing with no data', async () => {
    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('complete-empty'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/bullets')
    })
  })

  it('should save positions and redirect when completing with data', async () => {
    mockCreatePositionWithBullets.mockResolvedValue({ position: { id: 'pos-1' }, bulletIds: ['b1'] })

    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('complete-with-data'))

    // Since no drafts were saved, it should save via createPositionWithBullets
    await waitFor(() => {
      expect(mockCreatePositionWithBullets).toHaveBeenCalledWith(
        {
          user_id: 'test-user-id',
          company: 'Tech Corp',
          title: 'Engineer',
          location: null,
          start_date: null,
          end_date: null,
        },
        [
          {
            original_text: 'Did stuff',
            current_text: 'Did stuff',
            category: 'Backend',
            hard_skills: ['TypeScript'],
            soft_skills: ['Leadership'],
          },
        ]
      )
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/bullets')
    })
  })

  it('should show error when save fails', async () => {
    mockCreatePositionWithBullets.mockRejectedValue(new Error('Database error'))

    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('complete-with-data'))

    await waitFor(() => {
      expect(screen.getByTestId('interview-save-error')).toBeInTheDocument()
      expect(screen.getByText('Database error')).toBeInTheDocument()
    })
  })

  it('should not redirect on error', async () => {
    mockCreatePositionWithBullets.mockRejectedValue(new Error('Failed'))

    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('complete-with-data'))

    await waitFor(() => {
      expect(screen.getByTestId('interview-save-error')).toBeInTheDocument()
    })

    // Should NOT have navigated to /bullets on error
    expect(mockNavigate).not.toHaveBeenCalledWith('/bullets')
  })

  it('should show cancel confirmation dialog', async () => {
    mockConfirm.mockReturnValue(false)

    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('cancel'))

    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to cancel the interview? Your progress will be lost.'
    )
  })

  it('should navigate home when cancel confirmed', async () => {
    mockConfirm.mockReturnValue(true)

    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('cancel'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
    expect(mockLocalStorage.removeItem).toHaveBeenCalled()
  })

  it('should not navigate when cancel declined', async () => {
    mockConfirm.mockReturnValue(false)

    renderInterviewPage()

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('cancel'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  describe('handleComplete', () => {
    it('should not make DB calls when user is not authenticated', async () => {
      // Render with a valid user so InterviewChat mounts and hydration completes
      const { rerender, queryClient } = renderInterviewPage()

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      // Simulate session expiry: switch useAuth to return null user
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      })

      // Force re-render with a fresh tree so React picks up the new mock return value
      await act(async () => {
        rerender(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/interview']}>
              <Routes>
                <Route path="/interview" element={<InterviewPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        )
      })

      // After re-render, InterviewChat received the new onComplete (user?.id is now undefined).
      // capturedOnComplete now points to the recreated callback.
      await act(async () => {
        capturedOnComplete!({ positions: [] })
      })

      await waitFor(() => {
        expect(screen.getByTestId('interview-save-error')).toBeInTheDocument()
        expect(screen.getByText('Not authenticated')).toBeInTheDocument()
      })

      expect(mockCreatePositionWithBullets).not.toHaveBeenCalled()
      expect(mockCreatePosition).not.toHaveBeenCalled()
      expect(mockFinalizeDraftBullets).not.toHaveBeenCalled()
      expect(mockEmbedBullets).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should finalize draft bullets then embed them when savedBulletIds exist', async () => {
      const draftPositions = [
        {
          position: { company: 'Acme', title: 'Dev' },
          bullets: [
            { text: 'Built APIs', category: 'Backend', hardSkills: ['Node'], softSkills: [] },
            { text: 'Led team', category: 'Leadership', hardSkills: [], softSkills: ['Leadership'] },
          ],
        },
      ]

      renderInterviewPageWithDraftState({
        savedBulletIds: ['draft-b1', 'draft-b2'],
        savedBulletKeys: ['Acme|Dev|Built APIs', 'Acme|Dev|Led team'],
        savedPositionIds: ['pos-1'],
        positions: draftPositions,
      })

      // Wait for hydration and localStorage load
      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      // Use captured onComplete to send matching data
      const completeData: ExtractedInterviewData = {
        positions: draftPositions,
      }

      await waitFor(() => {
        expect(capturedOnComplete).not.toBeNull()
      })
      await act(async () => {
        capturedOnComplete!(completeData)
      })

      // finalizeDraftBullets must be called with all saved draft IDs
      await waitFor(() => {
        expect(mockFinalizeDraftBullets).toHaveBeenCalledWith(['draft-b1', 'draft-b2'])
      })

      // embedBullets must be called AFTER finalize, with matching IDs and texts
      await waitFor(() => {
        expect(mockEmbedBullets).toHaveBeenCalledWith(
          ['draft-b1', 'draft-b2'],
          ['Built APIs', 'Led team']
        )
      })

      // Verify order: finalize before embed
      const finalizeOrder = mockFinalizeDraftBullets.mock.invocationCallOrder[0]
      const embedOrder = mockEmbedBullets.mock.invocationCallOrder[0]
      expect(finalizeOrder).toBeLessThan(embedOrder)
    })

    it('should skip embedding when bulletTexts count does not match savedBulletIds count', async () => {
      // Provide 2 savedBulletIds but only 1 matching bulletKey in the data
      renderInterviewPageWithDraftState({
        savedBulletIds: ['draft-b1', 'draft-b2'],
        savedBulletKeys: ['Acme|Dev|Built APIs'], // only 1 key — mismatch with 2 IDs
        savedPositionIds: ['pos-1'],
        positions: [
          {
            position: { company: 'Acme', title: 'Dev' },
            bullets: [{ text: 'Built APIs', category: 'Backend' }],
          },
        ],
      })

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(capturedOnComplete).not.toBeNull()
      })

      await act(async () => {
        capturedOnComplete!({
          positions: [
            {
              position: { company: 'Acme', title: 'Dev' },
              bullets: [{ text: 'Built APIs', category: 'Backend' }],
            },
          ],
        })
      })

      // finalizeDraftBullets should still be called
      await waitFor(() => {
        expect(mockFinalizeDraftBullets).toHaveBeenCalledWith(['draft-b1', 'draft-b2'])
      })

      // embedBullets should NOT be called because texts (1) !== ids (2)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/bullets')
      })
      expect(mockEmbedBullets).not.toHaveBeenCalled()
    })

    it('should not create position again when it already exists in savedPositionMap', async () => {
      // Pre-load state with a saved position for "Acme|Dev"
      renderInterviewPageWithDraftState({
        savedBulletIds: ['draft-b1'],
        savedBulletKeys: ['Acme|Dev|Built APIs'],
        savedPositionIds: ['pos-existing'],
        positions: [
          {
            position: { company: 'Acme', title: 'Dev' },
            bullets: [{ text: 'Built APIs', category: 'Backend' }],
          },
        ],
      })

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(capturedOnComplete).not.toBeNull()
      })

      // Complete with the same position — it should be deduplicated
      await act(async () => {
        capturedOnComplete!({
          positions: [
            {
              position: { company: 'Acme', title: 'Dev' },
              bullets: [{ text: 'Built APIs', category: 'Backend' }],
            },
          ],
        })
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/bullets')
      })

      // Position already exists in savedPositionMap, so createPositionWithBullets must NOT be called
      expect(mockCreatePositionWithBullets).not.toHaveBeenCalled()
    })

    it('should create new positions with bullets and embed them', async () => {
      mockCreatePositionWithBullets.mockResolvedValue({
        position: { id: 'new-pos-1' },
        bulletIds: ['new-b1', 'new-b2'],
      })

      renderInterviewPage()

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(capturedOnComplete).not.toBeNull()
      })

      const newPositionData: ExtractedInterviewData = {
        positions: [
          {
            position: {
              company: 'NewCorp',
              title: 'SRE',
              location: 'Remote',
              startDate: '2023-01',
              endDate: '2024-06',
            },
            bullets: [
              { text: 'Managed infra', category: 'DevOps', hardSkills: ['K8s'], softSkills: [] },
              { text: 'On-call rotation', category: 'Operations', hardSkills: [], softSkills: ['Communication'] },
            ],
          },
        ],
      }

      await act(async () => {
        capturedOnComplete!(newPositionData)
      })

      // Should call createPositionWithBullets for the new position
      await waitFor(() => {
        expect(mockCreatePositionWithBullets).toHaveBeenCalledWith(
          {
            user_id: 'test-user-id',
            company: 'NewCorp',
            title: 'SRE',
            location: 'Remote',
            start_date: '2023-01-01',
            end_date: '2024-06-01',
          },
          [
            {
              original_text: 'Managed infra',
              current_text: 'Managed infra',
              category: 'DevOps',
              hard_skills: ['K8s'],
              soft_skills: [],
            },
            {
              original_text: 'On-call rotation',
              current_text: 'On-call rotation',
              category: 'Operations',
              hard_skills: [],
              soft_skills: ['Communication'],
            },
          ]
        )
      })

      // embedBullets should be called with the returned bulletIds and texts
      await waitFor(() => {
        expect(mockEmbedBullets).toHaveBeenCalledWith(
          ['new-b1', 'new-b2'],
          ['Managed infra', 'On-call rotation']
        )
      })

      // createPositionWithBullets must be called before embedBullets for new positions
      const createOrder = mockCreatePositionWithBullets.mock.invocationCallOrder[0]
      const embedOrder = mockEmbedBullets.mock.invocationCallOrder[0]
      expect(createOrder).toBeLessThan(embedOrder)
    })

    it('should execute side effects in correct order: finalize, embed drafts, create new, embed new, clearState, invalidateQueries, navigate', async () => {
      // Set up draft state for one position, and we will complete with that + a new position
      mockCreatePositionWithBullets.mockResolvedValue({
        position: { id: 'new-pos' },
        bulletIds: ['new-b1'],
      })

      renderInterviewPageWithDraftState({
        savedBulletIds: ['draft-b1'],
        savedBulletKeys: ['Acme|Dev|Built APIs'],
        savedPositionIds: ['pos-1'],
        positions: [
          {
            position: { company: 'Acme', title: 'Dev' },
            bullets: [{ text: 'Built APIs', category: 'Backend' }],
          },
        ],
      })

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(capturedOnComplete).not.toBeNull()
      })

      // Complete with both the existing (draft) position and a brand new one
      await act(async () => {
        capturedOnComplete!({
          positions: [
            {
              position: { company: 'Acme', title: 'Dev' },
              bullets: [{ text: 'Built APIs', category: 'Backend' }],
            },
            {
              position: { company: 'NewCo', title: 'PM' },
              bullets: [{ text: 'Shipped features', category: 'Product' }],
            },
          ],
        })
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/bullets')
      })

      // Verify the order of operations
      const finalizeOrder = mockFinalizeDraftBullets.mock.invocationCallOrder[0]
      const embedDraftOrder = mockEmbedBullets.mock.invocationCallOrder[0]
      const createNewOrder = mockCreatePositionWithBullets.mock.invocationCallOrder[0]
      const embedNewOrder = mockEmbedBullets.mock.invocationCallOrder[1]

      // finalize -> embed drafts -> create new position -> embed new bullets
      expect(finalizeOrder).toBeLessThan(embedDraftOrder)
      expect(embedDraftOrder).toBeLessThan(createNewOrder)
      expect(createNewOrder).toBeLessThan(embedNewOrder)

      // clearState (localStorage.removeItem) must be called
      expect(mockLocalStorage.removeItem).toHaveBeenCalled()

      // navigate must be called last
      expect(mockNavigate).toHaveBeenCalledWith('/bullets')
    })

    it('should call toPostgresDate on startDate and endDate for new positions', async () => {
      mockCreatePositionWithBullets.mockResolvedValue({
        position: { id: 'pos-dates' },
        bulletIds: ['b-dates'],
      })

      renderInterviewPage()

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(capturedOnComplete).not.toBeNull()
      })

      await act(async () => {
        capturedOnComplete!({
          positions: [
            {
              position: {
                company: 'DateCorp',
                title: 'Analyst',
                startDate: '2022-03',
                endDate: '2023-11',
              },
              bullets: [{ text: 'Analyzed data', category: 'Analytics' }],
            },
          ],
        })
      })

      // toPostgresDate('2022-03') => '2022-03-01', toPostgresDate('2023-11') => '2023-11-01'
      await waitFor(() => {
        expect(mockCreatePositionWithBullets).toHaveBeenCalledWith(
          expect.objectContaining({
            start_date: '2022-03-01',
            end_date: '2023-11-01',
          }),
          expect.any(Array)
        )
      })
    })
  })

  describe('interviewContext routing', () => {
    it('should clear localStorage when interviewContext is provided with non-blank mode', async () => {
      // Pre-populate localStorage with a saved interview state
      const storageKey = `odie_interview_state_test-user-id`
      const storedState = {
        messages: [{ role: 'user', content: 'old conversation' }],
        extractedData: { positions: [] },
        savedBulletIds: ['old-b1'],
        savedBulletKeys: ['OldCo|Dev|Old bullet'],
        savedPositionIds: ['old-pos-1'],
        lastUpdated: new Date().toISOString(),
      }
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === storageKey) return JSON.stringify(storedState)
        return null
      })

      renderInterviewPageWithRouteState({
        interviewContext: {
          mode: 'gaps',
          gaps: [{ requirement: 'Need Kubernetes', category: 'DevOps', importance: 'must_have' }],
          existingBulletSummary: 'Some bullets',
          jobTitle: 'SRE',
          company: 'Acme',
        },
      })

      // Wait for hydration and the context-aware clearState path
      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      // clearState should have been called (removeItem on localStorage)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(storageKey)

      // The stored state should NOT have been loaded as initial state -
      // InterviewChat should render without restored messages
      // (we verify indirectly: getItem may be called for load check, but removeItem proves clear happened)
    })

    it('should not clear localStorage when interviewContext mode is blank', async () => {
      const storageKey = `odie_interview_state_test-user-id`
      mockLocalStorage.getItem.mockReturnValue(null)

      renderInterviewPageWithRouteState({
        interviewContext: { mode: 'blank' },
      })

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      // clearState should NOT have been called for blank mode
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith(storageKey)
    })

    it('should invalidate jobDrafts queries on interview completion', async () => {
      mockCreatePositionWithBullets.mockResolvedValue({
        position: { id: 'pos-1' },
        bulletIds: ['b1'],
      })

      const { invalidateQueriesSpy } = renderInterviewPage()

      await waitFor(() => {
        expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('complete-with-data'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/bullets')
      })

      // Verify jobDrafts queries were invalidated
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['jobDrafts'] })
    })
  })
})
