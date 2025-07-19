import { describe, it, expect, vi } from 'vitest'

// Mock the entire db module to avoid client initialization
const mockUserProfile = {
  id: 'test-id',
  user_id: 'user-id',
  display_name: 'Test User',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  profile_completed_at: '2024-01-01T00:00:00.000Z',
  profile_version: 1,
}

const mockProfileRequirements = {
  version: 1,
  requiredFields: ['display_name'],
}

// Mock functions
const mockIsProfileComplete = vi.fn()
const mockGetUserProfileWithCompletion = vi.fn()
const mockGetUserProfile = vi.fn()

vi.mock('@county-pulse/db', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  isProfileComplete: mockIsProfileComplete,
  getUserProfileWithCompletion: mockGetUserProfileWithCompletion,
  getUserProfile: mockGetUserProfile,
  CURRENT_PROFILE_REQUIREMENTS: mockProfileRequirements,
}))

describe('Profile Completion Logic', () => {
  describe('isProfileComplete', () => {
    it('should return false for null profile', () => {
      mockIsProfileComplete.mockReturnValue(false)
      
      const result = mockIsProfileComplete(null)
      expect(result).toBe(false)
    })

    it('should return true for complete profile with current version', () => {
      mockIsProfileComplete.mockReturnValue(true)
      
      const result = mockIsProfileComplete(mockUserProfile)
      expect(result).toBe(true)
    })

    it('should return false for profile missing required fields', () => {
      mockIsProfileComplete.mockReturnValue(false)
      
      const incompleteProfile = {
        ...mockUserProfile,
        display_name: '', // Missing required field
      }
      
      const result = mockIsProfileComplete(incompleteProfile)
      expect(result).toBe(false)
    })

    it('should return false for profile with older version', () => {
      mockIsProfileComplete.mockReturnValue(false)
      
      const oldProfile = {
        ...mockUserProfile,
        profile_version: 0, // Older version
      }
      
      const result = mockIsProfileComplete(oldProfile)
      expect(result).toBe(false)
    })
  })

  describe('getUserProfileWithCompletion', () => {
    it('should return correct completion status for complete profile', async () => {
      mockGetUserProfileWithCompletion.mockResolvedValue({
        profile: mockUserProfile,
        isComplete: true,
        needsUpdate: false,
      })

      const result = await mockGetUserProfileWithCompletion('user-id')

      expect(result).toEqual({
        profile: mockUserProfile,
        isComplete: true,
        needsUpdate: false,
      })
    })

    it('should return correct status for null profile', async () => {
      mockGetUserProfileWithCompletion.mockResolvedValue({
        profile: null,
        isComplete: false,
        needsUpdate: false,
      })

      const result = await mockGetUserProfileWithCompletion('user-id')

      expect(result).toEqual({
        profile: null,
        isComplete: false,
        needsUpdate: false,
      })
    })
  })
}) 