import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Navigation } from '../../../components/layout/Navigation'

// Mock useAuth
vi.mock('../../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
}))

function renderWithRouter(component: React.ReactNode, initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      {component}
    </MemoryRouter>
  )
}

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render navigation with all links', () => {
    renderWithRouter(<Navigation />)

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-home')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-resumes')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-bullets')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-interview')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-telemetry')).toBeInTheDocument()
  })

  it('should display Odie logo', () => {
    renderWithRouter(<Navigation />)

    expect(screen.getByText('Odie')).toBeInTheDocument()
  })

  it('should display user email', () => {
    renderWithRouter(<Navigation />)

    expect(screen.getByTestId('nav-email')).toHaveTextContent('test@example.com')
  })

  it('should have sign out button', () => {
    renderWithRouter(<Navigation />)

    expect(screen.getByTestId('nav-signout')).toBeInTheDocument()
  })

  it('should highlight active link', () => {
    renderWithRouter(<Navigation />, '/bullets')

    const bulletsLink = screen.getByTestId('nav-link-bullets')
    expect(bulletsLink).toHaveClass('nav__link--active')
  })

  it('should call signOut when sign out button is clicked', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined)
    vi.mocked(await import('../../../components/auth/AuthProvider')).useAuth = () => ({
      user: { id: 'test-user-id', email: 'test@example.com' },
      loading: false,
      signIn: vi.fn(),
      signOut: mockSignOut,
    })

    renderWithRouter(<Navigation />)

    await userEvent.click(screen.getByTestId('nav-signout'))

    expect(mockSignOut).toHaveBeenCalled()
  })
})
