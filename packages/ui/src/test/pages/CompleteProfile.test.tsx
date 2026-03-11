import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CompleteProfile } from '../../pages/CompleteProfile'

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

// Mock @odie/db functions
const mockGetUserProfile = vi.fn().mockResolvedValue(null)
const mockGetCandidateProfile = vi.fn().mockResolvedValue(null)
const mockCreateUserProfile = vi.fn().mockResolvedValue({})
const mockUpdateUserProfile = vi.fn().mockResolvedValue({})
const mockMarkProfileComplete = vi.fn().mockResolvedValue({})
const mockUpsertCandidateProfile = vi.fn().mockResolvedValue({})

vi.mock('@odie/db', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  getCandidateProfile: (...args: unknown[]) => mockGetCandidateProfile(...args),
  createUserProfile: (...args: unknown[]) => mockCreateUserProfile(...args),
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
  markProfileComplete: (...args: unknown[]) => mockMarkProfileComplete(...args),
  upsertCandidateProfile: (...args: unknown[]) => mockUpsertCandidateProfile(...args),
}))

function renderCompleteProfile() {
  return render(
    <BrowserRouter>
      <CompleteProfile />
    </BrowserRouter>
  )
}

describe('CompleteProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserProfile.mockResolvedValue(null)
    mockGetCandidateProfile.mockResolvedValue(null)
  })

  it('should render the profile form with all fields', () => {
    renderCompleteProfile()

    expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
    expect(screen.getByTestId('input-phone')).toBeInTheDocument()
    expect(screen.getByTestId('input-location')).toBeInTheDocument()
    expect(screen.getByTestId('input-linkedin')).toBeInTheDocument()
    expect(screen.getByTestId('input-github')).toBeInTheDocument()
    expect(screen.getByTestId('input-website')).toBeInTheDocument()
  })

  it('should render labels for contact fields', () => {
    renderCompleteProfile()

    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/linkedin/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/github/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument()
  })

  it('should load existing profile data on mount', async () => {
    mockGetUserProfile.mockResolvedValue({ display_name: 'Existing User' })
    mockGetCandidateProfile.mockResolvedValue({
      phone: '(555) 999-1234',
      location: 'New York, NY',
      linkedin_url: 'https://linkedin.com/in/existing',
      github_url: 'https://github.com/existing',
      website_url: 'https://existing.dev',
    })

    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toHaveValue('Existing User')
    })
    expect(screen.getByTestId('input-phone')).toHaveValue('(555) 999-1234')
    expect(screen.getByTestId('input-location')).toHaveValue('New York, NY')
    expect(screen.getByTestId('input-linkedin')).toHaveValue('https://linkedin.com/in/existing')
    expect(screen.getByTestId('input-github')).toHaveValue('https://github.com/existing')
    expect(screen.getByTestId('input-website')).toHaveValue('https://existing.dev')
  })

  it('should submit form with contact fields for new user', async () => {
    const user = userEvent.setup()
    renderCompleteProfile()

    await user.type(screen.getByTestId('input-display-name'), 'New User')
    await user.type(screen.getByTestId('input-phone'), '(555) 111-2222')
    await user.type(screen.getByTestId('input-location'), 'Austin, TX')
    await user.type(screen.getByTestId('input-linkedin'), 'https://linkedin.com/in/newuser')
    await user.type(screen.getByTestId('input-github'), 'https://github.com/newuser')
    await user.type(screen.getByTestId('input-website'), 'https://newuser.dev')

    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(mockCreateUserProfile).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        display_name: 'New User',
      })
    })

    expect(mockUpsertCandidateProfile).toHaveBeenCalledWith('test-user-id', {
      phone: '(555) 111-2222',
      location: 'Austin, TX',
      linkedin_url: 'https://linkedin.com/in/newuser',
      github_url: 'https://github.com/newuser',
      website_url: 'https://newuser.dev',
    })

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should not call upsertCandidateProfile when no contact fields are filled', async () => {
    const user = userEvent.setup()
    renderCompleteProfile()

    await user.type(screen.getByTestId('input-display-name'), 'Name Only')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(mockCreateUserProfile).toHaveBeenCalled()
    })
    expect(mockUpsertCandidateProfile).not.toHaveBeenCalled()
  })

  it('should disable submit when display name is empty', () => {
    renderCompleteProfile()

    const submitButton = screen.getByRole('button', { name: /continue/i })
    expect(submitButton).toBeDisabled()
  })

  it('should show Update Profile heading when existing profile is loaded', async () => {
    mockGetUserProfile.mockResolvedValue({ display_name: 'Existing' })

    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByText('Update Profile')).toBeInTheDocument()
    })
  })

  it('should show Complete Your Profile heading for new users', () => {
    renderCompleteProfile()

    expect(screen.getByText('Complete Your Profile')).toBeInTheDocument()
  })

  it('should display error message on submission failure', async () => {
    const user = userEvent.setup()
    mockCreateUserProfile.mockRejectedValue(new Error('Network error'))

    renderCompleteProfile()

    await user.type(screen.getByTestId('input-display-name'), 'Test User')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })
})
