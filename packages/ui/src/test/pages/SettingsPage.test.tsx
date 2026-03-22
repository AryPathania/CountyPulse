import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// Mock ResetAccountButton to avoid deep dependency chains
vi.mock('../../components/account', () => ({
  ResetAccountButton: () => (
    <button data-testid="reset-account-button">Reset Account</button>
  ),
}))

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

  it('renders the page root with correct testid', () => {
    renderSettingsPage()
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  it('renders the page title', () => {
    renderSettingsPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderSettingsPage()
    expect(screen.getByText('Account settings and preferences')).toBeInTheDocument()
  })

  it('renders a link to the Profile page', () => {
    renderSettingsPage()
    const link = screen.getByRole('link', { name: 'Profile page' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/profile')
  })

  it('renders the danger zone section', () => {
    renderSettingsPage()
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument()
    expect(screen.getByTestId('reset-account-button')).toBeInTheDocument()
  })

  it('does not render profile form (moved to ProfilePage)', () => {
    renderSettingsPage()
    expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-profile-section')).not.toBeInTheDocument()
  })
})
