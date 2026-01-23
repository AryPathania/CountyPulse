import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInterviewStorage, type InterviewStorageState } from '../../hooks/useInterviewStorage'

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
  }),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('useInterviewStorage', () => {
  const testUserId = 'test-user-123'
  const storageKey = `odie_interview_state_${testUserId}`

  const mockState: Omit<InterviewStorageState, 'lastUpdated'> = {
    messages: [
      { role: 'assistant', content: 'Hello! How can I help you?' },
      { role: 'user', content: 'I worked at Acme Corp' },
    ],
    extractedData: {
      positions: [
        {
          position: {
            company: 'Acme Corp',
            title: 'Software Engineer',
            location: 'San Francisco',
            startDate: '2022-01-01',
            endDate: null,
          },
          bullets: [
            {
              text: 'Led development of microservices',
              category: 'Leadership',
              hardSkills: ['Docker', 'Kubernetes'],
              softSkills: ['Communication'],
            },
          ],
        },
      ],
    },
    savedBulletIds: ['bullet-1', 'bullet-2'],
    savedPositionIds: ['position-1'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loadState', () => {
    it('returns null when no stored data', () => {
      const { result } = renderHook(() => useInterviewStorage(testUserId))

      const loaded = result.current.loadState()

      expect(loaded).toBeNull()
      expect(localStorageMock.getItem).toHaveBeenCalledWith(storageKey)
    })

    it('returns parsed data when stored', () => {
      const storedData: InterviewStorageState = {
        ...mockState,
        lastUpdated: '2024-01-15T10:00:00Z',
      }
      mockLocalStorage[storageKey] = JSON.stringify(storedData)

      const { result } = renderHook(() => useInterviewStorage(testUserId))

      const loaded = result.current.loadState()

      expect(loaded).toEqual(storedData)
      expect(loaded?.messages).toHaveLength(2)
      expect(loaded?.extractedData.positions).toHaveLength(1)
      expect(loaded?.savedBulletIds).toEqual(['bullet-1', 'bullet-2'])
    })

    it('returns null on invalid JSON', () => {
      mockLocalStorage[storageKey] = 'invalid json {'

      const { result } = renderHook(() => useInterviewStorage(testUserId))

      const loaded = result.current.loadState()

      expect(loaded).toBeNull()
    })

    it('returns null when userId is undefined', () => {
      const { result } = renderHook(() => useInterviewStorage(undefined))

      const loaded = result.current.loadState()

      expect(loaded).toBeNull()
      expect(localStorageMock.getItem).not.toHaveBeenCalled()
    })
  })

  describe('saveState', () => {
    it('stores data with lastUpdated timestamp', () => {
      const { result } = renderHook(() => useInterviewStorage(testUserId))

      act(() => {
        result.current.saveState(mockState)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        storageKey,
        expect.any(String)
      )

      const savedData = JSON.parse(mockLocalStorage[storageKey])
      expect(savedData.messages).toEqual(mockState.messages)
      expect(savedData.extractedData).toEqual(mockState.extractedData)
      expect(savedData.savedBulletIds).toEqual(mockState.savedBulletIds)
      expect(savedData.lastUpdated).toBeDefined()
      expect(new Date(savedData.lastUpdated).getTime()).toBeGreaterThan(0)
    })

    it('does not save when userId is undefined', () => {
      const { result } = renderHook(() => useInterviewStorage(undefined))

      act(() => {
        result.current.saveState(mockState)
      })

      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })
  })

  describe('clearState', () => {
    it('removes data from localStorage', () => {
      mockLocalStorage[storageKey] = JSON.stringify({ ...mockState, lastUpdated: 'now' })

      const { result } = renderHook(() => useInterviewStorage(testUserId))

      act(() => {
        result.current.clearState()
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(storageKey)
    })

    it('does not remove when userId is undefined', () => {
      const { result } = renderHook(() => useInterviewStorage(undefined))

      act(() => {
        result.current.clearState()
      })

      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
    })
  })

  describe('storage key', () => {
    it('is user-specific (odie_interview_state_{userId})', () => {
      const userId1 = 'user-abc'
      const userId2 = 'user-xyz'

      const { result: result1 } = renderHook(() => useInterviewStorage(userId1))
      const { result: result2 } = renderHook(() => useInterviewStorage(userId2))

      act(() => {
        result1.current.saveState(mockState)
        result2.current.saveState({
          ...mockState,
          messages: [{ role: 'assistant', content: 'Different message' }],
        })
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `odie_interview_state_${userId1}`,
        expect.any(String)
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `odie_interview_state_${userId2}`,
        expect.any(String)
      )

      // Verify different data stored for different users
      const data1 = JSON.parse(mockLocalStorage[`odie_interview_state_${userId1}`])
      const data2 = JSON.parse(mockLocalStorage[`odie_interview_state_${userId2}`])
      expect(data1.messages[0].content).not.toEqual(data2.messages[0].content)
    })
  })

  describe('isHydrated', () => {
    it('returns true after mount', async () => {
      const { result } = renderHook(() => useInterviewStorage(testUserId))

      // After the effect runs, isHydrated should be true
      expect(result.current.isHydrated).toBe(true)
    })
  })

  describe('full round-trip', () => {
    it('can save and load state correctly', () => {
      const { result } = renderHook(() => useInterviewStorage(testUserId))

      // Save state
      act(() => {
        result.current.saveState(mockState)
      })

      // Load state
      const loaded = result.current.loadState()

      expect(loaded).not.toBeNull()
      expect(loaded?.messages).toEqual(mockState.messages)
      expect(loaded?.extractedData).toEqual(mockState.extractedData)
      expect(loaded?.savedBulletIds).toEqual(mockState.savedBulletIds)
      expect(loaded?.savedPositionIds).toEqual(mockState.savedPositionIds)
    })

    it('can clear and verify state is gone', () => {
      const { result } = renderHook(() => useInterviewStorage(testUserId))

      // Save state
      act(() => {
        result.current.saveState(mockState)
      })

      // Verify it exists
      expect(result.current.loadState()).not.toBeNull()

      // Clear state
      act(() => {
        result.current.clearState()
      })

      // Verify it's gone
      expect(result.current.loadState()).toBeNull()
    })
  })
})
