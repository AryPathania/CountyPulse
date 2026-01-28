import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'odie_interview_state'

export interface InterviewStorageState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  extractedData: {
    positions: Array<{
      position: {
        company: string
        title: string
        location?: string | null
        startDate?: string | null
        endDate?: string | null
      }
      bullets: Array<{
        text: string
        category?: string | null
        hardSkills?: string[]
        softSkills?: string[]
      }>
    }>
  }
  savedBulletIds: string[]
  savedBulletKeys: string[] // bulletKeys for deduplication: `${company}|${title}|${text}`
  savedPositionIds: string[]
  lastUpdated: string
}

/**
 * Hook to persist interview state to localStorage.
 * This allows interview progress to survive page refreshes and tab switches.
 * State is keyed by userId to support multi-user scenarios.
 */
export function useInterviewStorage(userId: string | undefined) {
  const [isHydrated, setIsHydrated] = useState(false)

  const getStorageKey = useCallback(() => {
    return userId ? `${STORAGE_KEY}_${userId}` : null
  }, [userId])

  const loadState = useCallback((): InterviewStorageState | null => {
    const key = getStorageKey()
    if (!key) return null

    try {
      const stored = localStorage.getItem(key)
      if (!stored) return null
      return JSON.parse(stored)
    } catch {
      return null
    }
  }, [getStorageKey])

  const saveState = useCallback(
    (state: Omit<InterviewStorageState, 'lastUpdated'>) => {
      const key = getStorageKey()
      if (!key) return

      localStorage.setItem(
        key,
        JSON.stringify({
          ...state,
          lastUpdated: new Date().toISOString(),
        })
      )
    },
    [getStorageKey]
  )

  const clearState = useCallback(() => {
    const key = getStorageKey()
    if (key) {
      localStorage.removeItem(key)
    }
  }, [getStorageKey])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return {
    loadState,
    saveState,
    clearState,
    isHydrated,
  }
}
