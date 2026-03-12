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
const mockGetProfile = vi.fn().mockResolvedValue(null)
const mockUpsertProfile = vi.fn().mockResolvedValue({})
const mockMarkProfileComplete = vi.fn().mockResolvedValue({})

vi.mock('@odie/db', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  upsertProfile: (...args: unknown[]) => mockUpsertProfile(...args),
  markProfileComplete: (...args: unknown[]) => mockMarkProfileComplete(...args),
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
    mockGetProfile.mockResolvedValue(null)
    mockUpsertProfile.mockResolvedValue({})
    mockMarkProfileComplete.mockResolvedValue({})
  })

  it('should render the profile form with basic fields', async () => {
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
    })
    expect(screen.getByTestId('input-phone')).toBeInTheDocument()
    expect(screen.getByTestId('input-location')).toBeInTheDocument()
    expect(screen.getByTestId('btn-add-link-LinkedIn')).toBeInTheDocument()
  })

  it('should render labels for contact fields', async () => {
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
  })

  it('should load existing profile data on mount', async () => {
    mockGetProfile.mockResolvedValue({
      user_id: 'test-user-id',
      display_name: 'Existing User',
      phone: '(555) 999-1234',
      location: 'New York, NY',
      links: [
        { label: 'LinkedIn', url: 'https://linkedin.com/in/existing' },
        { label: 'GitHub', url: 'https://github.com/existing' },
      ],
      headline: null,
      summary: null,
      profile_completed_at: null,
      profile_version: 1,
      created_at: null,
      updated_at: '2024-01-01T00:00:00Z',
    })

    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toHaveValue('Existing User')
    })
    expect(screen.getByTestId('input-phone')).toHaveValue('(555) 999-1234')
    expect(screen.getByTestId('input-location')).toHaveValue('New York, NY')
    expect(screen.getByTestId('input-link-label-0')).toHaveValue('LinkedIn')
    expect(screen.getByTestId('input-link-url-0')).toHaveValue('https://linkedin.com/in/existing')
    expect(screen.getByTestId('input-link-label-1')).toHaveValue('GitHub')
    expect(screen.getByTestId('input-link-url-1')).toHaveValue('https://github.com/existing')
  })

  it('should submit form with links for new user (create mode)', async () => {
    const user = userEvent.setup()
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
    })

    await user.type(screen.getByTestId('input-display-name'), 'New User')
    await user.type(screen.getByTestId('input-phone'), '(555) 111-2222')
    await user.type(screen.getByTestId('input-location'), 'Austin, TX')

    // Add a LinkedIn link via quick-add button
    await user.click(screen.getByTestId('btn-add-link-LinkedIn'))
    await user.type(screen.getByTestId('input-link-url-0'), 'https://linkedin.com/in/newuser')

    await user.click(screen.getByTestId('btn-save-profile'))

    await waitFor(() => {
      expect(mockUpsertProfile).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          display_name: 'New User',
          phone: '(555) 111-2222',
          location: 'Austin, TX',
          links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/newuser' }],
        })
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should allow adding and removing links', async () => {
    const user = userEvent.setup()
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('btn-add-link-LinkedIn')).toBeInTheDocument()
    })

    // Add two links via quick-add buttons
    await user.click(screen.getByTestId('btn-add-link-LinkedIn'))
    await user.click(screen.getByTestId('btn-add-link-GitHub'))
    expect(screen.getByTestId('input-link-label-0')).toBeInTheDocument()
    expect(screen.getByTestId('input-link-label-1')).toBeInTheDocument()

    // Remove the first one
    await user.click(screen.getByTestId('btn-remove-link-0'))
    expect(screen.queryByTestId('input-link-label-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('input-link-label-0')).toBeInTheDocument()
  })

  it('should disable submit when display name is empty', async () => {
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('btn-save-profile')).toBeInTheDocument()
    })

    const submitButton = screen.getByTestId('btn-save-profile')
    expect(submitButton).toBeDisabled()
  })

  it('should show Update Profile heading when existing profile is loaded', async () => {
    mockGetProfile.mockResolvedValue({
      user_id: 'test-user-id',
      display_name: 'Existing',
      headline: null,
      summary: null,
      phone: null,
      location: null,
      links: [],
      profile_completed_at: null,
      profile_version: 1,
      created_at: null,
      updated_at: '2024-01-01T00:00:00Z',
    })

    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByText('Update Profile')).toBeInTheDocument()
    })
  })

  it('should show Complete Your Profile heading for new users', async () => {
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByText('Complete Your Profile')).toBeInTheDocument()
    })
  })

  it('should display error message on submission failure', async () => {
    const user = userEvent.setup()
    mockUpsertProfile.mockRejectedValue(new Error('Network error'))

    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
    })

    await user.type(screen.getByTestId('input-display-name'), 'Test User')
    await user.click(screen.getByTestId('btn-save-profile'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('should call upsertProfile and markProfileComplete in update mode', async () => {
    mockGetProfile.mockResolvedValue({
      user_id: 'test-user-id',
      display_name: 'Old Name',
      headline: null,
      summary: null,
      phone: '(555) 000-0000',
      location: null,
      links: [],
      profile_completed_at: null,
      profile_version: 1,
      created_at: null,
      updated_at: '2024-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderCompleteProfile()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toHaveValue('Old Name')
    })

    // Clear and retype display name
    await user.clear(screen.getByTestId('input-display-name'))
    await user.type(screen.getByTestId('input-display-name'), 'New Name')
    await user.click(screen.getByTestId('btn-save-profile'))

    await waitFor(() => {
      expect(mockUpsertProfile).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({ display_name: 'New Name' })
      )
    })
    expect(mockMarkProfileComplete).toHaveBeenCalledWith('test-user-id')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
