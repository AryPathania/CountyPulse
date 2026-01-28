import { useCallback, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../components/auth/AuthProvider'
import { Navigation } from '../components/layout'
import { InterviewChat } from '../components/interview/InterviewChat'
import {
  createPositionWithBullets,
  createPosition,
  createDraftBullet,
  finalizeDraftBullets,
} from '@odie/db'
import type { ExtractedInterviewData, ChatMessage } from '@odie/shared'
import { toPostgresDate } from '@odie/shared'
import { useInterviewStorage, type InterviewStorageState } from '../hooks/useInterviewStorage'
import './InterviewPage.css'

/**
 * Interview page for collecting user's career history.
 * Handles the chat UI and persists extracted data to the database.
 */
export function InterviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persistence state
  const { loadState, saveState, clearState, isHydrated } = useInterviewStorage(user?.id)
  const [initialState, setInitialState] = useState<InterviewStorageState | null>(null)
  const [savedBulletIds, setSavedBulletIds] = useState<string[]>([])
  const [savedPositionMap, setSavedPositionMap] = useState<Map<string, string>>(new Map())
  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false)

  // Track previously saved bullets to avoid duplicates
  const previouslySavedBulletsRef = useRef<Set<string>>(new Set())

  // Refs to track current values for localStorage persistence without causing callback recreation
  const savedBulletIdsRef = useRef<string[]>([])
  const savedPositionMapRef = useRef<Map<string, string>>(new Map())

  // Load initial state from localStorage on mount
  useEffect(() => {
    if (isHydrated && user?.id && !hasLoadedInitialState) {
      const stored = loadState()
      if (stored) {
        setInitialState(stored)
        setSavedBulletIds(stored.savedBulletIds)
        savedBulletIdsRef.current = stored.savedBulletIds
        // Rebuild position map from saved IDs
        const posMap = new Map<string, string>()
        stored.savedPositionIds.forEach((id, idx) => {
          if (stored.extractedData.positions[idx]) {
            const pos = stored.extractedData.positions[idx].position
            const key = `${pos.company}|${pos.title}`
            posMap.set(key, id)
          }
        })
        setSavedPositionMap(posMap)
        savedPositionMapRef.current = posMap
        // Restore bulletKeys for deduplication (not UUIDs)
        const bulletKeys = stored.savedBulletKeys ?? []
        bulletKeys.forEach((key) => previouslySavedBulletsRef.current.add(key))
      }
      setHasLoadedInitialState(true)
    }
  }, [isHydrated, user?.id, loadState, hasLoadedInitialState])

  // Handle state changes from InterviewChat - save to localStorage and create draft bullets
  const handleStateChange = useCallback(
    async (messages: ChatMessage[], extractedData: ExtractedInterviewData) => {
      if (!user?.id) return

      // Save new bullets as drafts when they appear
      for (const positionData of extractedData.positions) {
        const positionKey = `${positionData.position.company}|${positionData.position.title}`

        // Create position if not already saved
        let positionId = savedPositionMap.get(positionKey)
        if (!positionId) {
          try {
            const created = await createPosition({
              user_id: user.id,
              company: positionData.position.company,
              title: positionData.position.title,
              location: positionData.position.location ?? null,
              start_date: toPostgresDate(positionData.position.startDate),
              end_date: toPostgresDate(positionData.position.endDate),
            })
            positionId = created.id
            setSavedPositionMap((prev) => new Map(prev).set(positionKey, positionId!))
            savedPositionMapRef.current = new Map(savedPositionMapRef.current).set(positionKey, positionId!)
          } catch (err) {
            console.error('Failed to create position:', err)
            continue
          }
        }

        // Create draft bullets for any new bullets
        for (const bullet of positionData.bullets) {
          // Create a unique key for the bullet to track if we've already saved it
          const bulletKey = `${positionKey}|${bullet.text}`
          if (previouslySavedBulletsRef.current.has(bulletKey)) {
            continue
          }

          try {
            const created = await createDraftBullet({
              user_id: user.id,
              position_id: positionId,
              original_text: bullet.text,
              current_text: bullet.text,
              category: bullet.category ?? null,
              hard_skills: bullet.hardSkills ?? [],
              soft_skills: bullet.softSkills ?? [],
            })
            previouslySavedBulletsRef.current.add(bulletKey)
            setSavedBulletIds((prev) => [...prev, created.id])
            savedBulletIdsRef.current = [...savedBulletIdsRef.current, created.id]

            // Invalidate bullets query so BulletsPage shows the draft
            queryClient.invalidateQueries({ queryKey: ['bullets'] })
          } catch (err) {
            console.error('Failed to create draft bullet:', err)
          }
        }
      }

      // Save state to localStorage (use refs to avoid callback recreation)
      saveState({
        messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        extractedData,
        savedBulletIds: savedBulletIdsRef.current,
        savedBulletKeys: Array.from(previouslySavedBulletsRef.current),
        savedPositionIds: Array.from(savedPositionMapRef.current.values()),
      })
    },
    [user?.id, saveState, queryClient]
  )

  const handleComplete = useCallback(
    async (data: ExtractedInterviewData) => {
      if (!user?.id) {
        setError('Not authenticated')
        return
      }

      setIsSaving(true)
      setError(null)

      try {
        // Finalize all draft bullets
        if (savedBulletIds.length > 0) {
          await finalizeDraftBullets(savedBulletIds)
        }

        // For any positions/bullets not yet saved as drafts, save them now
        for (const { position, bullets } of data.positions) {
          const positionKey = `${position.company}|${position.title}`
          const existingPositionId = savedPositionMap.get(positionKey)

          // If position not yet created, create it with bullets
          if (!existingPositionId && bullets.length > 0) {
            const unsavedBullets = bullets.filter((b) => {
              const bulletKey = `${positionKey}|${b.text}`
              return !previouslySavedBulletsRef.current.has(bulletKey)
            })

            if (unsavedBullets.length > 0) {
              await createPositionWithBullets(
                {
                  user_id: user.id,
                  company: position.company,
                  title: position.title,
                  location: position.location ?? null,
                  start_date: toPostgresDate(position.startDate),
                  end_date: toPostgresDate(position.endDate),
                },
                unsavedBullets.map((b) => ({
                  original_text: b.text,
                  current_text: b.text,
                  category: b.category,
                  hard_skills: b.hardSkills,
                  soft_skills: b.softSkills,
                }))
              )
            }
          }
        }

        // Clear localStorage
        clearState()

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['bullets'] })

        // Redirect to bullets library
        navigate('/bullets')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save interview data')
        setIsSaving(false)
      }
    },
    [user?.id, navigate, savedBulletIds, savedPositionMap, clearState, queryClient]
  )

  const handleCancel = useCallback(() => {
    if (window.confirm('Are you sure you want to cancel the interview? Your progress will be lost.')) {
      // Clear localStorage on cancel
      clearState()
      navigate('/')
    }
  }, [navigate, clearState])

  return (
    <div className="interview-page" data-testid="interview-page">
      <Navigation />
      <div className="interview-page__container">
        {isSaving && (
          <div className="interview-page__saving" data-testid="interview-saving">
            <div className="saving-spinner" />
            <span>Saving your data...</span>
          </div>
        )}

        {error && (
          <div className="interview-page__error" data-testid="interview-save-error">
            {error}
          </div>
        )}

        {!isHydrated || !hasLoadedInitialState ? (
          <div className="interview-page__loading" data-testid="interview-loading">
            Loading...
          </div>
        ) : (
          <InterviewChat
            onComplete={handleComplete}
            onCancel={handleCancel}
            initialMessages={
              initialState?.messages.map((m, idx) => ({
                id: `restored-${idx}`,
                role: m.role,
                content: m.content,
                timestamp: new Date().toISOString(),
              }))
            }
            initialExtractedData={initialState?.extractedData}
            onStateChange={handleStateChange}
          />
        )}
      </div>
    </div>
  )
}
