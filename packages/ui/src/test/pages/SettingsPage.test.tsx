import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { queryClient } from '../../lib/queryClient'
import { SettingsPage } from '../../pages/SettingsPage'

// Mock useAuth
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
  }),
}))

// Mock @odie/db
const mockGetProfile = vi.fn()
const mockUpsertProfile = vi.fn()

vi.mock('@odie/db', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  upsertProfile: (...args: unknown[]) => mockUpsertProfile(...args),
  mapProfileToFormData: (profile: { display_name?: string | null; headline?: string | null; summary?: string | null; phone?: string | null; location?: string | null; links?: unknown[] | null } | null) => ({
    displayName: profile?.display_name ?? '',
    headline: profile?.headline ?? null,
    summary: profile?.summary ?? null,
    phone: profile?.phone ?? null,
    location: profile?.location ?? null,
    links: (profile?.links ?? []) as { label: string; url: string }[],
  }),
}))

// Mock ResetAccountButton to avoid deep dependency chains
vi.mock('../../components/account', () => ({
  ResetAccountButton: () => (
    <button data-testid="reset-account-button">Reset Account</button>
  ),
}))

const MOCK_PROFILE = {
  user_id: 'test-user-id',
  display_name: 'Test User',
  headline: 'Senior Software Engineer',
  summary: 'Experienced engineer',
  phone: '555-1234',
  location: 'San Francisco, CA',
  links: [{ label: 'GitHub', url: 'https://github.com/testuser' }],
  profile_completed_at: '2024-01-01T00:00:00Z',
  profile_version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

function renderSettingsPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('renders the page root with correct testid', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  it('renders the page title', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    expect(screen.getByText('Profile & Settings')).toBeInTheDocument()
  })

  it('renders loading state while data is fetching', async () => {
    // Never resolving promise = perpetual loading
    mockGetProfile.mockReturnValue(new Promise(() => {}))

    renderSettingsPage()

    expect(screen.getByTestId('settings-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
  })

  it('renders ProfileForm after data loads', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    })
  })

  it('populates ProfileForm with loaded data', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('input-display-name')).toHaveValue('Test User')
    })
    expect(screen.getByTestId('input-headline')).toHaveValue(
      'Senior Software Engineer',
    )
    expect(screen.getByTestId('input-email')).toHaveValue('test@example.com')
  })

  it('uses empty defaults when profile is null', async () => {
    mockGetProfile.mockResolvedValue(null)

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    })
    expect(screen.getByTestId('input-display-name')).toHaveValue('')
    expect(screen.getByTestId('input-headline')).toHaveValue('')
  })

  it('calls upsertProfile on save', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)
    mockUpsertProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('btn-save-profile'))

    await waitFor(() => {
      expect(mockUpsertProfile).toHaveBeenCalledWith('test-user-id', {
        display_name: 'Test User',
        headline: 'Senior Software Engineer',
        summary: 'Experienced engineer',
        phone: '555-1234',
        location: 'San Francisco, CA',
        links: [{ label: 'GitHub', url: 'https://github.com/testuser' }],
      })
    })
  })

  it('renders the profile section with correct testid', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    expect(screen.getByTestId('settings-profile-section')).toBeInTheDocument()
  })

  it('renders the danger zone section', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    expect(screen.getByTestId('danger-zone')).toBeInTheDocument()
    expect(screen.getByTestId('reset-account-button')).toBeInTheDocument()
  })

  it('profile form is interactive after load', async () => {
    mockGetProfile.mockResolvedValue(MOCK_PROFILE)

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    })

    const displayNameInput = screen.getByTestId('input-display-name')
    await userEvent.clear(displayNameInput)
    await userEvent.type(displayNameInput, 'New Name')
    expect(displayNameInput).toHaveValue('New Name')
  })

  it('save succeeds when getProfile returns null (no existing profile row)', async () => {
    mockGetProfile.mockResolvedValue(null)
    mockUpsertProfile.mockResolvedValue({})

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    })

    const displayNameInput = screen.getByTestId('input-display-name')
    await userEvent.clear(displayNameInput)
    await userEvent.type(displayNameInput, 'New Name')

    await userEvent.click(screen.getByTestId('btn-save-profile'))

    await waitFor(() => {
      expect(mockUpsertProfile).toHaveBeenCalled()
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
