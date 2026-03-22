import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from '../../../components/auth/SignOutButton'

const mockSignOut = vi.fn()
vi.mock('../../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}))

describe('SignOutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
  })

  it('renders with "Sign out" text', () => {
    render(<SignOutButton />)

    const button = screen.getByTestId('signout-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Sign out')
  })

  it('applies className prop', () => {
    render(<SignOutButton className="custom-class" />)

    expect(screen.getByTestId('signout-button')).toHaveClass('custom-class')
  })

  it('calls signOut on click', async () => {
    render(<SignOutButton />)

    await userEvent.click(screen.getByTestId('signout-button'))

    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it('shows "Signing out..." loading state during sign out', async () => {
    // Make signOut hang so we can observe the loading state
    mockSignOut.mockReturnValue(new Promise(() => {}))

    render(<SignOutButton />)

    await userEvent.click(screen.getByTestId('signout-button'))

    expect(screen.getByTestId('signout-button')).toHaveTextContent('Signing out...')
    expect(screen.getByTestId('signout-button')).toBeDisabled()
  })

  it('re-enables button after sign out error', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'))

    render(<SignOutButton />)

    await userEvent.click(screen.getByTestId('signout-button'))

    await waitFor(() => {
      expect(screen.getByTestId('signout-button')).toHaveTextContent('Sign out')
      expect(screen.getByTestId('signout-button')).not.toBeDisabled()
    })
  })
})
