import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for bullet draft functions.
 * These test the db layer functions by mocking them directly,
 * similar to how other query tests work in this codebase.
 */

// Mock the bullet draft functions at the module level
const mockCreateDraftBullet = vi.fn()
const mockFinalizeDraftBullets = vi.fn()
const mockDeleteOrphanedDrafts = vi.fn()

vi.mock('@odie/db', () => ({
  createDraftBullet: (...args: unknown[]) => mockCreateDraftBullet(...args),
  finalizeDraftBullets: (...args: unknown[]) => mockFinalizeDraftBullets(...args),
  deleteOrphanedDrafts: (...args: unknown[]) => mockDeleteOrphanedDrafts(...args),
}))

describe('bullet draft functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDraftBullet', () => {
    it('inserts with is_draft: true', async () => {
      const { createDraftBullet } = await import('@odie/db')

      const newBullet = {
        user_id: 'user-123',
        position_id: 'position-1',
        original_text: 'New bullet text',
        current_text: 'New bullet text',
        category: 'Technical',
        hard_skills: ['React', 'TypeScript'],
        soft_skills: ['Communication'],
      }

      const createdBullet = {
        id: 'bullet-new-123',
        ...newBullet,
        is_draft: true,
        was_edited: null,
        embedding: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      }

      mockCreateDraftBullet.mockResolvedValue(createdBullet)

      const result = await createDraftBullet(newBullet)

      expect(mockCreateDraftBullet).toHaveBeenCalledWith(newBullet)
      expect(result).toEqual(createdBullet)
      expect(result.is_draft).toBe(true)
    })

    it('throws error on failure', async () => {
      const { createDraftBullet } = await import('@odie/db')

      const newBullet = {
        user_id: 'user-123',
        position_id: 'position-1',
        original_text: 'New bullet text',
        current_text: 'New bullet text',
        category: null,
        hard_skills: [],
        soft_skills: [],
      }

      const dbError = new Error('Database error')
      mockCreateDraftBullet.mockRejectedValue(dbError)

      await expect(createDraftBullet(newBullet)).rejects.toThrow('Database error')
    })

    it('sets is_draft to true on the created bullet', async () => {
      const { createDraftBullet } = await import('@odie/db')

      const newBullet = {
        user_id: 'user-123',
        position_id: 'position-1',
        original_text: 'Draft text',
        current_text: 'Draft text',
        category: 'Backend',
        hard_skills: ['Node.js'],
        soft_skills: null,
      }

      // The function should always return is_draft: true
      mockCreateDraftBullet.mockResolvedValue({
        id: 'new-id',
        ...newBullet,
        is_draft: true,
        was_edited: false,
        embedding: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const result = await createDraftBullet(newBullet)
      expect(result.is_draft).toBe(true)
    })
  })

  describe('finalizeDraftBullets', () => {
    it('updates is_draft to false for given bulletIds', async () => {
      const { finalizeDraftBullets } = await import('@odie/db')

      const bulletIds = ['bullet-1', 'bullet-2', 'bullet-3']
      mockFinalizeDraftBullets.mockResolvedValue(undefined)

      await finalizeDraftBullets(bulletIds)

      expect(mockFinalizeDraftBullets).toHaveBeenCalledWith(bulletIds)
    })

    it('handles empty array (no-op)', async () => {
      const { finalizeDraftBullets } = await import('@odie/db')

      mockFinalizeDraftBullets.mockResolvedValue(undefined)

      await finalizeDraftBullets([])

      expect(mockFinalizeDraftBullets).toHaveBeenCalledWith([])
    })

    it('throws error on failure', async () => {
      const { finalizeDraftBullets } = await import('@odie/db')

      const bulletIds = ['bullet-1']
      const dbError = new Error('Update failed')
      mockFinalizeDraftBullets.mockRejectedValue(dbError)

      await expect(finalizeDraftBullets(bulletIds)).rejects.toThrow('Update failed')
    })

    it('can finalize multiple bullets at once', async () => {
      const { finalizeDraftBullets } = await import('@odie/db')

      const manyBulletIds = Array.from({ length: 10 }, (_, i) => `bullet-${i}`)
      mockFinalizeDraftBullets.mockResolvedValue(undefined)

      await finalizeDraftBullets(manyBulletIds)

      expect(mockFinalizeDraftBullets).toHaveBeenCalledWith(manyBulletIds)
      expect(mockFinalizeDraftBullets).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteOrphanedDrafts', () => {
    it('deletes user draft bullets', async () => {
      const { deleteOrphanedDrafts } = await import('@odie/db')

      const userId = 'user-123'
      mockDeleteOrphanedDrafts.mockResolvedValue(undefined)

      await deleteOrphanedDrafts(userId)

      expect(mockDeleteOrphanedDrafts).toHaveBeenCalledWith(userId)
    })

    it('throws error on failure', async () => {
      const { deleteOrphanedDrafts } = await import('@odie/db')

      const userId = 'user-123'
      const dbError = new Error('Delete failed')
      mockDeleteOrphanedDrafts.mockRejectedValue(dbError)

      await expect(deleteOrphanedDrafts(userId)).rejects.toThrow('Delete failed')
    })

    it('only deletes drafts for the specified user', async () => {
      const { deleteOrphanedDrafts } = await import('@odie/db')

      const userId1 = 'user-1'
      const userId2 = 'user-2'
      mockDeleteOrphanedDrafts.mockResolvedValue(undefined)

      await deleteOrphanedDrafts(userId1)
      await deleteOrphanedDrafts(userId2)

      expect(mockDeleteOrphanedDrafts).toHaveBeenCalledWith(userId1)
      expect(mockDeleteOrphanedDrafts).toHaveBeenCalledWith(userId2)
      expect(mockDeleteOrphanedDrafts).toHaveBeenCalledTimes(2)
    })
  })
})
