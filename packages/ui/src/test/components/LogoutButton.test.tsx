import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogoutButton } from '../../components/auth/LogoutButton'

// Mock auth context
const mockAuthContext = {
  user: { id: 'test-user', email: 'test@example.com' } as any,
  session: null,
  userProfile: { display_name: 'Test User' } as any,
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
}

vi.mock('../../components/auth/AuthProvider', async () => {
  const actual = await vi.importActual('../../components/auth/AuthProvider')
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  }
})

describe('LogoutButton', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock context to default state
    mockAuthContext.user = { id: 'test-user', email: 'test@example.com' }
    mockAuthContext.userProfile = { display_name: 'Test User' }
    mockAuthContext.signOut = vi.fn()
  })

  it('should render logout button with user display name', () => {
    render(<LogoutButton />)

    expect(
      screen.getByRole('button', { name: 'Sign Out (Test User)' })
    ).toBeInTheDocument()
  })

  it('should render logout button with user email when no display name', () => {
    mockAuthContext.userProfile = null

    render(<LogoutButton />)

    expect(
      screen.getByRole('button', { name: 'Sign Out (test@example.com)' })
    ).toBeInTheDocument()
  })

  it('should not render when no user is logged in', () => {
    mockAuthContext.user = null

    render(<LogoutButton />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should call signOut when clicked', async () => {
    render(<LogoutButton />)

    const logoutButton = screen.getByRole('button', {
      name: 'Sign Out (Test User)',
    })
    await user.click(logoutButton)

    expect(mockAuthContext.signOut).toHaveBeenCalledOnce()
  })

  it('should show loading state during signout', async () => {
    mockAuthContext.signOut = vi.fn().mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<LogoutButton />)

    const logoutButton = screen.getByRole('button', {
      name: 'Sign Out (Test User)',
    })
    await user.click(logoutButton)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Signing out...' })
      ).toBeDisabled()
    })
  })

  it('should handle signout errors gracefully', async () => {
    mockAuthContext.signOut = vi.fn().mockRejectedValue(new Error('Signout failed'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<LogoutButton />)

    const logoutButton = screen.getByRole('button', {
      name: 'Sign Out (Test User)',
    })
    await user.click(logoutButton)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Sign out error:',
        expect.any(Error)
      )
    })

    // Button should be enabled again after error
    expect(logoutButton).not.toBeDisabled()

    consoleSpy.mockRestore()
  })
}) 