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
vi.mock('@odie/db', () => ({
  getJobDrafts: vi.fn().mockResolvedValue([
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
  ]),
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
})
