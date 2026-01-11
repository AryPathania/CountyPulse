import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { HomePage } from '../../pages/HomePage'

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

function renderHomePage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('should render home page with JD input', () => {
    renderHomePage()

    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.getByTestId('jd-input')).toBeInTheDocument()
    expect(screen.getByTestId('jd-submit')).toBeInTheDocument()
  })

  it('should display hero text', () => {
    renderHomePage()

    expect(screen.getByText('Craft your perfect resume')).toBeInTheDocument()
    expect(screen.getByText(/Paste a job description/)).toBeInTheDocument()
  })

  it('should disable submit button when input is empty', () => {
    renderHomePage()

    expect(screen.getByTestId('jd-submit')).toBeDisabled()
  })

  it('should enable submit button when text is entered', async () => {
    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'Looking for a software engineer...')

    expect(screen.getByTestId('jd-submit')).not.toBeDisabled()
  })

  it('should navigate to draft page on submit', async () => {
    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'Looking for a software engineer...')
    await userEvent.click(screen.getByTestId('jd-submit'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/resumes/draft',
        expect.objectContaining({ state: { jdText: 'Looking for a software engineer...' } })
      )
    })
  })

  it('should have quick action buttons', () => {
    renderHomePage()

    expect(screen.getByTestId('start-interview')).toBeInTheDocument()
    expect(screen.getByTestId('view-bullets')).toBeInTheDocument()
  })

  it('should navigate to interview on quick action click', async () => {
    renderHomePage()

    await userEvent.click(screen.getByTestId('start-interview'))

    expect(mockNavigate).toHaveBeenCalledWith('/interview')
  })

  it('should navigate to bullets on quick action click', async () => {
    renderHomePage()

    await userEvent.click(screen.getByTestId('view-bullets'))

    expect(mockNavigate).toHaveBeenCalledWith('/bullets')
  })
})
