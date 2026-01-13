import { useState, useCallback } from 'react'
import { useAuth } from '../components/auth/AuthProvider'
import { Navigation } from '../components/layout/Navigation'
import { BulletsList, BulletEditor } from '../components/bullets'
import { useBullets, useUpdateBullet, useDeleteBullet } from '../queries/bullets'
import type { BulletWithPosition } from '@odie/db'
import './BulletsPage.css'

/**
 * Bullets Library page.
 * Layout: left list panel (filters + bullets), right editor panel.
 * Uses TanStack Query for data fetching.
 */
export function BulletsPage() {
  const { user } = useAuth()
  const [selectedBulletId, setSelectedBulletId] = useState<string | null>(null)

  // Fetch all bullets
  const {
    data: bullets = [],
    isLoading,
    error,
  } = useBullets(user?.id)

  // Mutations
  const updateBulletMutation = useUpdateBullet()
  const deleteBulletMutation = useDeleteBullet()

  // Find selected bullet from the list
  const selectedBullet: BulletWithPosition | null =
    bullets.find((b) => b.id === selectedBulletId) ?? null

  const handleSelectBullet = useCallback((bulletId: string) => {
    setSelectedBulletId(bulletId)
  }, [])

  const handleSave = useCallback(
    (updates: {
      current_text: string
      category?: string | null
      hard_skills?: string[] | null
      soft_skills?: string[] | null
    }) => {
      if (!selectedBulletId) return

      updateBulletMutation.mutate(
        { bulletId: selectedBulletId, updates },
        {
          onSuccess: () => {
            // Keep the bullet selected after save
          },
          onError: (err) => {
            console.error('Failed to update bullet:', err)
            // TODO: Show toast notification
          },
        }
      )
    },
    [selectedBulletId, updateBulletMutation]
  )

  const handleCancel = useCallback(() => {
    setSelectedBulletId(null)
  }, [])

  const handleDelete = useCallback(
    (bulletId: string) => {
      if (!window.confirm('Are you sure you want to delete this bullet?')) {
        return
      }

      deleteBulletMutation.mutate(bulletId, {
        onSuccess: () => {
          // Clear selection if deleted bullet was selected
          if (selectedBulletId === bulletId) {
            setSelectedBulletId(null)
          }
        },
        onError: (err) => {
          console.error('Failed to delete bullet:', err)
          // TODO: Show toast notification
        },
      })
    },
    [deleteBulletMutation, selectedBulletId]
  )

  const handleAddBullet = useCallback(() => {
    // TODO: Implement add bullet modal/form
    console.log('Add bullet clicked')
  }, [])

  return (
    <div className="bullets-page" data-testid="bullets-page">
      <Navigation />
      <header className="bullets-page__header">
        <h1 className="bullets-page__title">Bullets Library</h1>
        <p className="bullets-page__subtitle">
          Manage and edit your resume bullet points
        </p>
      </header>

      <div className="bullets-page__content">
        {/* Left panel: List */}
        <aside className="bullets-page__list-panel" data-testid="bullets-list-panel">
          <BulletsList
            bullets={bullets}
            selectedBulletId={selectedBulletId}
            onSelectBullet={handleSelectBullet}
            onDeleteBullet={handleDelete}
            onAddBullet={handleAddBullet}
            loading={isLoading}
            error={error instanceof Error ? error : null}
          />
        </aside>

        {/* Right panel: Editor */}
        <main className="bullets-page__editor-panel" data-testid="bullets-editor-panel">
          <BulletEditor
            bullet={selectedBullet}
            onSave={handleSave}
            onCancel={handleCancel}
            saving={updateBulletMutation.isPending}
          />
        </main>
      </div>
    </div>
  )
}
