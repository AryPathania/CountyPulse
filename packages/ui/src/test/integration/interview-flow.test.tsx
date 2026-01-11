import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { InterviewPage } from '../../pages/InterviewPage'
import { resetMockState } from '../../services/interview'
import { resetInterviewMock } from '../mocks/handlers/interview'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useAuth to provide authenticated user
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Wrapper component with all providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Interview Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    resetInterviewMock()
    queryClient.clear()
  })

  it('should render interview page', async () => {
    render(
      <TestWrapper>
        <InterviewPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('interview-page')).toBeInTheDocument()
    })
  })

  it('should show interview chat component', async () => {
    render(
      <TestWrapper>
        <InterviewPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('interview-chat')).toBeInTheDocument()
    })
  })

  it('should navigate to bullets page after completing interview', async () => {
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <TestWrapper>
        <InterviewPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('interview-chat')).toBeInTheDocument()
    })

    // End the interview
    await userEvent.click(screen.getByTestId('interview-end'))

    // Complete the interview
    await waitFor(() => {
      expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
    })

    // Click finish
    await userEvent.click(screen.getByTestId('interview-finish'))

    // Should navigate to bullets page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/bullets')
    })
  })

  it('should ask for confirmation when canceling', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <TestWrapper>
        <InterviewPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('interview-cancel'))

    expect(confirmSpy).toHaveBeenCalled()
    // Should NOT navigate because user declined
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('should navigate home when user confirms cancel', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <TestWrapper>
        <InterviewPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('interview-chat')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('interview-cancel'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should show initial greeting from Odie', async () => {
    render(
      <TestWrapper>
        <InterviewPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/I'm Odie/)).toBeInTheDocument()
    })
  })
})
