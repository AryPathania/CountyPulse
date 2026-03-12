import { useState, useCallback } from 'react'
import { upsertProfile } from '@odie/db'
import type { ProfileFormData } from '@odie/shared'

export function useProfileSave(userId: string) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(
    async (data: ProfileFormData) => {
      setIsSaving(true)
      setError(null)
      try {
        await upsertProfile(userId, {
          display_name: data.displayName,
          headline: data.headline,
          summary: data.summary,
          phone: data.phone,
          location: data.location,
          links: data.links,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save profile')
        throw e
      } finally {
        setIsSaving(false)
      }
    },
    [userId],
  )

  return { save, isSaving, error }
}
