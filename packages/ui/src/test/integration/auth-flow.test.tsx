import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CompleteProfile } from '../../pages/CompleteProfile'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the simplified AuthProvider
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock database functions
vi.mock('@county-pulse/db', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  getUserProfile: vi.fn().mockResolvedValue(null),
  createUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  markProfileComplete: vi.fn(),
}))

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Auth Flow Integration', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('CompleteProfile', () => {
    it('should create new profile and redirect to dashboard', async () => {
      const { createUserProfile } = await import('@county-pulse/db')
      
      vi.mocked(createUserProfile).mockResolvedValue({
        id: 'new-profile-id',
        user_id: 'test-user',
        display_name: 'New User',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        profile_completed_at: '2024-01-01T00:00:00.000Z',
        profile_version: 1,
      })

      renderWithRouter(<CompleteProfile />)

      const displayNameInput = screen.getByLabelText('Display Name')
      const continueButton = screen.getByRole('button', { name: 'Continue' })

      await user.type(displayNameInput, 'New User')
      await user.click(continueButton)

      await waitFor(() => {
        expect(createUserProfile).toHaveBeenCalledWith({
          user_id: 'test-user',
          display_name: 'New User',
        })
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should prevent double submission', async () => {
      const { createUserProfile } = await import('@county-pulse/db')
      
      // Make createUserProfile hang to simulate slow network
      vi.mocked(createUserProfile).mockImplementation(
        () => new Promise(() => {})
      )

      renderWithRouter(<CompleteProfile />)

      const displayNameInput = screen.getByLabelText('Display Name')
      const continueButton = screen.getByRole('button', { name: 'Continue' })

      await user.type(displayNameInput, 'New User')
      
      // Click multiple times quickly
      await user.click(continueButton)
      await user.click(continueButton)
      await user.click(continueButton)

      // Should only call once
      await waitFor(() => {
        expect(createUserProfile).toHaveBeenCalledTimes(1)
      })
    })
  })
}) 