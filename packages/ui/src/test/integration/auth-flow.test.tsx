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
const mockGetProfile = vi.fn().mockResolvedValue(null)
const mockUpsertProfile = vi.fn()
const mockMarkProfileComplete = vi.fn()

vi.mock('@odie/db', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  upsertProfile: (...args: unknown[]) => mockUpsertProfile(...args),
  markProfileComplete: (...args: unknown[]) => mockMarkProfileComplete(...args),
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
    mockGetProfile.mockResolvedValue(null)
  })

  describe('CompleteProfile', () => {
    it('should create new profile and redirect to dashboard', async () => {
      mockUpsertProfile.mockResolvedValue({
        user_id: 'test-user',
        display_name: 'New User',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        profile_completed_at: '2024-01-01T00:00:00.000Z',
        profile_version: 1,
        headline: null,
        summary: null,
        phone: null,
        location: null,
        links: [],
      })

      renderWithRouter(<CompleteProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
      })

      const displayNameInput = screen.getByTestId('input-display-name')
      const saveButton = screen.getByTestId('btn-save-profile')

      await user.type(displayNameInput, 'New User')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpsertProfile).toHaveBeenCalledWith(
          'test-user',
          expect.objectContaining({
            display_name: 'New User',
          })
        )
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should prevent double submission', async () => {
      // Make upsertProfile hang to simulate slow network
      mockUpsertProfile.mockImplementation(
        () => new Promise(() => {})
      )

      renderWithRouter(<CompleteProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
      })

      const displayNameInput = screen.getByTestId('input-display-name')
      const saveButton = screen.getByTestId('btn-save-profile')

      await user.type(displayNameInput, 'New User')

      // Click multiple times quickly
      await user.click(saveButton)
      await user.click(saveButton)
      await user.click(saveButton)

      // Should only call once
      await waitFor(() => {
        expect(mockUpsertProfile).toHaveBeenCalledTimes(1)
      })
    })
  })
})
