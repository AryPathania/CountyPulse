import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../../components/auth/LoginForm'

const { mockSignIn, mockSignOut, mockRefreshProfile } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockRefreshProfile: vi.fn(),
}))

vi.mock('../../components/auth/AuthProvider', async () => {
  const actual = await vi.importActual('../../components/auth/AuthProvider')
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      session: null,
      userProfile: null,
      loading: false,
      signIn: mockSignIn, // ✅ Now these are controllable per test
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// Still need to mock the database module to prevent initialization issues
vi.mock('@odie/db', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  getUserProfile: vi.fn().mockResolvedValue(null),
  getUserProfileWithCompletion: vi.fn().mockResolvedValue({
    profile: null,
    isComplete: false,
    needsUpdate: false,
  }),
}))

const renderLoginForm = () => {
  return render(<LoginForm />)
}

describe('LoginForm', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    // Don't set default behavior - let each test control its own mock setup
  })

  it('should render login form correctly', () => {
    mockSignIn.mockResolvedValue(undefined)
    renderLoginForm()

    expect(screen.getByText('Welcome to Odie AI')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('should handle email input', async () => {
    mockSignIn.mockResolvedValue(undefined)
    renderLoginForm()

    const emailInput = screen.getByPlaceholderText('your@email.com')
    await user.type(emailInput, 'test@example.com')

    expect(emailInput).toHaveValue('test@example.com')
  })

  it('should submit form and show success message', async () => {
    mockSignIn.mockResolvedValue(undefined)

    renderLoginForm()

    const emailInput = screen.getByPlaceholderText('your@email.com')
    const submitButton = screen.getByRole('button', { name: 'Continue' })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com')
      expect(screen.getByText('Check Your Email')).toBeInTheDocument()
      expect(screen.getByText(/We have sent a magic link to/)).toBeInTheDocument()
    })
  })

  it('should disable submit button when loading', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {})) // Never resolves

    renderLoginForm()

    const emailInput = screen.getByPlaceholderText('your@email.com')
    const submitButton = screen.getByRole('button', { name: 'Continue' })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()
    })
  })

  it('should handle auth errors', async () => {
    // Set up error mock BEFORE component is rendered
    mockSignIn.mockImplementation(() => Promise.reject(new Error('Auth failed')))

    renderLoginForm()

    const emailInput = screen.getByPlaceholderText('your@email.com')
    const submitButton = screen.getByRole('button', { name: 'Continue' })

    // Use valid email format to pass HTML5 validation
    await user.type(emailInput, 'error@example.com')
    await user.click(submitButton)

    // Verify signIn was called
    expect(mockSignIn).toHaveBeenCalledWith('error@example.com')

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText('Auth failed')).toBeInTheDocument()
    })

    // Verify the form stays in initial state (not success state)
    expect(screen.getByText('Welcome to Odie AI')).toBeInTheDocument()
    expect(screen.queryByText('Check Your Email')).not.toBeInTheDocument()
  })

  it('should allow user to try different email after sending', async () => {
    mockSignIn.mockResolvedValue(undefined)
    renderLoginForm()

    const emailInput = screen.getByPlaceholderText('your@email.com')
    const submitButton = screen.getByRole('button', { name: 'Continue' })

    // Submit initial email
    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Check Your Email')).toBeInTheDocument()
    })

    // Click "Try Different Email" button
    const tryDifferentEmailButton = screen.getByRole('button', {
      name: 'Try Different Email',
    })
    await user.click(tryDifferentEmailButton)

    // Should be back to initial form
    expect(screen.getByText('Welcome to Odie AI')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('your@email.com')).toHaveValue('')
  })
}) 