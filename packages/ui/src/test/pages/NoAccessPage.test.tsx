import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NoAccessPage } from '../../pages/NoAccessPage'

const mockUseAuth = vi.fn()

vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../components/auth/SignOutButton', () => ({
  SignOutButton: ({ className }: { className?: string }) => (
    <button data-testid="signout-button" className={className}>Sign out</button>
  ),
}))

function renderNoAccessPage() {
  return render(
    <MemoryRouter>
      <NoAccessPage />
    </MemoryRouter>,
  )
}

describe('NoAccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page with correct testid', () => {
    mockUseAuth.mockReturnValue({ user: null })

    renderNoAccessPage()

    expect(screen.getByTestId('no-access-page')).toBeInTheDocument()
  })

  it('renders the access limited title', () => {
    mockUseAuth.mockReturnValue({ user: null })

    renderNoAccessPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Access Limited' })).toBeInTheDocument()
  })

  it('renders the beta testers message', () => {
    mockUseAuth.mockReturnValue({ user: null })

    renderNoAccessPage()

    expect(
      screen.getByText('Odie AI is currently available to beta testers only.'),
    ).toBeInTheDocument()
  })

  it('shows user email when available', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'alice@example.com' },
    })

    renderNoAccessPage()

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument()
  })

  it('does not show email section when user has no email', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
    })

    renderNoAccessPage()

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
  })

  it('does not show email section when no user', () => {
    mockUseAuth.mockReturnValue({ user: null })

    renderNoAccessPage()

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
  })

  it('renders the sign out button', () => {
    mockUseAuth.mockReturnValue({ user: null })

    renderNoAccessPage()

    expect(screen.getByTestId('signout-button')).toBeInTheDocument()
  })

  it('passes correct className to SignOutButton', () => {
    mockUseAuth.mockReturnValue({ user: null })

    renderNoAccessPage()

    expect(screen.getByTestId('signout-button')).toHaveClass('no-access-page__signout')
  })
})
