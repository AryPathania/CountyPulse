import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AccessGuard } from '../../components/auth/AccessGuard'

const mockUseAccess = vi.fn()

vi.mock('../../hooks/useAccess', () => ({
  useAccess: () => mockUseAccess(),
}))

// Track Navigate calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Navigate: (props: { to: string; replace?: boolean }) => {
      mockNavigate(props)
      return null
    },
  }
})

describe('AccessGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when hasAccess is true', () => {
    mockUseAccess.mockReturnValue({ hasAccess: true, isLoading: false })

    render(
      <MemoryRouter>
        <AccessGuard>
          <div data-testid="protected">Protected Content</div>
        </AccessGuard>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /no-access when hasAccess is false', () => {
    mockUseAccess.mockReturnValue({ hasAccess: false, isLoading: false })

    render(
      <MemoryRouter>
        <AccessGuard>
          <div data-testid="protected">Protected Content</div>
        </AccessGuard>
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/no-access', replace: true }),
    )
  })

  it('shows loading state while checking access', () => {
    mockUseAccess.mockReturnValue({ hasAccess: false, isLoading: true })

    render(
      <MemoryRouter>
        <AccessGuard>
          <div data-testid="protected">Protected Content</div>
        </AccessGuard>
      </MemoryRouter>,
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not render children during loading even if hasAccess is true', () => {
    mockUseAccess.mockReturnValue({ hasAccess: true, isLoading: true })

    render(
      <MemoryRouter>
        <AccessGuard>
          <div data-testid="protected">Protected Content</div>
        </AccessGuard>
      </MemoryRouter>,
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })
})
