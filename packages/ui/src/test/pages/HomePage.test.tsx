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

// Mock useAuth - uses a fn so tests can override return value
const mockUseAuth = vi.fn()
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock jd-processing service
const mockProcessJobDescription = vi.fn()
vi.mock('../../services/jd-processing', () => ({
  processJobDescription: (...args: unknown[]) => mockProcessJobDescription(...args),
}))

// Mock fetchJd service
const mockFetchJdText = vi.fn()
const mockIsUrl = vi.fn()
vi.mock('../../services/fetchJd', () => ({
  fetchJdText: (...args: unknown[]) => mockFetchJdText(...args),
  isUrl: (...args: unknown[]) => mockIsUrl(...args),
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
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    // Default: plain text input (not a URL), processJobDescription succeeds
    mockIsUrl.mockReturnValue(false)
    mockProcessJobDescription.mockResolvedValue({ draftId: 'draft-abc' })
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

  it('should call processJobDescription and navigate to draft on submit', async () => {
    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'Looking for a software engineer...')
    await userEvent.click(screen.getByTestId('jd-submit'))

    await waitFor(() => {
      expect(mockProcessJobDescription).toHaveBeenCalledWith(
        'test-user-id',
        'Looking for a software engineer...'
      )
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/resumes/draft-abc')
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

  it('should navigate to upload resume on quick action click', async () => {
    renderHomePage()

    await userEvent.click(screen.getByTestId('upload-resume'))

    expect(mockNavigate).toHaveBeenCalledWith('/upload-resume')
  })

  it('shows "Fetching job description..." when a URL is pasted and submitted', async () => {
    mockIsUrl.mockReturnValue(true)
    // fetchJdText hangs so we can observe the loading label
    mockFetchJdText.mockReturnValue(new Promise(() => {}))

    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'https://greenhouse.io/jobs/123')
    await userEvent.click(screen.getByTestId('jd-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('jd-submit')).toHaveTextContent('Fetching job description...')
    })
  })

  it('shows error when URL fetch fails', async () => {
    mockIsUrl.mockReturnValue(true)
    mockFetchJdText.mockRejectedValue(new Error('Network error'))

    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'https://greenhouse.io/jobs/123')
    await userEvent.click(screen.getByTestId('jd-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('jd-error')).toBeInTheDocument()
    })

    expect(screen.getByTestId('jd-error')).toHaveTextContent('Network error')
    expect(mockProcessJobDescription).not.toHaveBeenCalled()
  })

  it('calls processJobDescription with fetched text, not the raw URL', async () => {
    mockIsUrl.mockReturnValue(true)
    mockFetchJdText.mockResolvedValue('Fetched JD text')
    mockProcessJobDescription.mockResolvedValue({ draftId: 'draft-url-1' })

    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'https://greenhouse.io/jobs/123')
    await userEvent.click(screen.getByTestId('jd-submit'))

    await waitFor(() => {
      expect(mockProcessJobDescription).toHaveBeenCalledWith('test-user-id', 'Fetched JD text')
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/resumes/draft-url-1')
    })
  })

  it('should not navigate when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })

    renderHomePage()

    const input = screen.getByTestId('jd-input')
    await userEvent.type(input, 'Looking for a software engineer...')

    // Submit button only checks text, not auth — but handleSubmit guards on user?.id
    await userEvent.click(screen.getByTestId('jd-submit'))

    // navigate should NOT be called when user is null
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
