import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthGuard } from '../../../components/auth/AuthGuard'

// Mock useAuth with different states
const mockUseAuth = vi.fn()
vi.mock('../../../components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('AuthGuard', () => {
  it('should show loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should show default fallback when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Please log in to access this content.')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should show custom fallback when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(
      <AuthGuard fallback={<div>Custom Login Message</div>}>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Custom Login Message')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should render children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      loading: false,
    })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    expect(screen.queryByText('Please log in to access this content.')).not.toBeInTheDocument()
  })
})
