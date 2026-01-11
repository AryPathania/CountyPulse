import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { InterviewPage } from '../../pages/InterviewPage'
import type { ExtractedInterviewData } from '@odie/shared'

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
const mockUser = { id: 'test-user-id', email: 'test@example.com' }
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

// Mock @odie/db
const mockCreatePositionWithBullets = vi.fn()
vi.mock('@odie/db', () => ({
  createPositionWithBullets: (...args: unknown[]) => mockCreatePositionWithBullets(...args),
}))

// Mock InterviewChat component to control its behavior
vi.mock('../../components/interview/InterviewChat', () => ({
  InterviewChat: ({
    onComplete,
    onCancel,
  }: {
    onComplete: (data: ExtractedInterviewData) => void
    onCancel: () => void
  }) => {
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

function renderInterviewPage() {
  return render(
    <MemoryRouter initialEntries={['/interview']}>
      <Routes>
        <Route path="/interview" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('InterviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(false)
  })

  it('should render interview page', () => {
    renderInterviewPage()

    expect(screen.getByTestId('interview-page')).toBeInTheDocument()
    expect(screen.getByTestId('mock-interview-chat')).toBeInTheDocument()
  })

  it('should redirect to bullets when completing with no data', async () => {
    renderInterviewPage()

    await userEvent.click(screen.getByTestId('complete-empty'))

    expect(mockNavigate).toHaveBeenCalledWith('/bullets')
    expect(mockCreatePositionWithBullets).not.toHaveBeenCalled()
  })

  it('should save positions and redirect when completing with data', async () => {
    mockCreatePositionWithBullets.mockResolvedValue({ id: 'pos-1' })

    renderInterviewPage()

    await userEvent.click(screen.getByTestId('complete-with-data'))

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

    expect(mockNavigate).toHaveBeenCalledWith('/bullets')
  })

  it('should show error when save fails', async () => {
    mockCreatePositionWithBullets.mockRejectedValue(new Error('Database error'))

    renderInterviewPage()

    await userEvent.click(screen.getByTestId('complete-with-data'))

    await waitFor(() => {
      expect(screen.getByTestId('interview-save-error')).toBeInTheDocument()
      expect(screen.getByText('Database error')).toBeInTheDocument()
    })
  })

  it('should not redirect on error', async () => {
    mockCreatePositionWithBullets.mockRejectedValue(new Error('Failed'))

    renderInterviewPage()

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

    await userEvent.click(screen.getByTestId('cancel'))

    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to cancel the interview? Your progress will be lost.'
    )
  })

  it('should navigate home when cancel confirmed', async () => {
    mockConfirm.mockReturnValue(true)

    renderInterviewPage()

    await userEvent.click(screen.getByTestId('cancel'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should not navigate when cancel declined', async () => {
    mockConfirm.mockReturnValue(false)

    renderInterviewPage()

    await userEvent.click(screen.getByTestId('cancel'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
