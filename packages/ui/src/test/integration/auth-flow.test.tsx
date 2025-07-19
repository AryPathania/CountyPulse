import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../components/auth/AuthProvider'
import { AuthCallback } from '../../pages/AuthCallback'
import { CompleteProfile } from '../../pages/CompleteProfile'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Define mock here to avoid hoisting issues
vi.mock('@county-pulse/db', () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }
  
  return {
    supabase: mockSupabase,
    getUserProfile: vi.fn(),
    getUserProfileWithCompletion: vi.fn(),
    createUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    markProfileComplete: vi.fn(),
  }
})

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{component}</AuthProvider>
    </BrowserRouter>
  )
}

describe('Auth Flow Integration', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('AuthCallback', () => {
    it('should redirect to complete profile for new users', async () => {
      const { getUserProfileWithCompletion, supabase } = await import('@county-pulse/db')
      
      vi.mocked(getUserProfileWithCompletion).mockResolvedValue({
        profile: null,
        isComplete: false,
        needsUpdate: false,
      })

      // Mock authenticated user
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user', email: 'test@example.com' } as any,
          },
        },
        error: null,
      } as any)

      renderWithRouter(<AuthCallback />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/complete-profile')
      })
    })

    it('should redirect to dashboard for users with complete profiles', async () => {
      const { getUserProfileWithCompletion, supabase } = await import('@county-pulse/db')
      
      vi.mocked(getUserProfileWithCompletion).mockResolvedValue({
        profile: {
          id: 'profile-id',
          user_id: 'test-user',
          display_name: 'Test User',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          profile_completed_at: '2024-01-01T00:00:00.000Z',
          profile_version: 1,
        },
        isComplete: true,
        needsUpdate: false,
      })

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user', email: 'test@example.com' } as any,
          },
        },
        error: null,
      } as any)

      renderWithRouter(<AuthCallback />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('CompleteProfile', () => {
    it('should create new profile and redirect to dashboard', async () => {
      const { createUserProfile, supabase } = await import('@county-pulse/db')
      
      // Mock authenticated user
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user', email: 'test@example.com' } as any,
          },
        },
        error: null,
      } as any)
      
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
      const { createUserProfile, supabase } = await import('@county-pulse/db')
      
      // Mock authenticated user
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user', email: 'test@example.com' } as any,
          },
        },
        error: null,
      } as any)
      
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