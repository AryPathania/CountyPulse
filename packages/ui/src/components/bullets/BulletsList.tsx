import { useState, useMemo } from 'react'
import type { BulletWithPosition } from '@odie/db'
import './BulletsList.css'

export interface BulletsListProps {
  bullets: BulletWithPosition[]
  selectedBulletId: string | null
  onSelectBullet: (bulletId: string) => void
  onDeleteBullet?: (bulletId: string) => void
  loading?: boolean
  error?: Error | null
}

/**
 * Display a filterable list of bullets with position context.
 */
export function BulletsList({
  bullets,
  selectedBulletId,
  onSelectBullet,
  onDeleteBullet,
  loading = false,
  error = null,
}: BulletsListProps) {
  const [filterText, setFilterText] = useState('')

  const filteredBullets = useMemo(() => {
    if (!filterText.trim()) {
      return bullets
    }

    const search = filterText.toLowerCase()
    return bullets.filter((bullet) => {
      const textMatch = bullet.current_text.toLowerCase().includes(search)
      const categoryMatch = bullet.category?.toLowerCase().includes(search)
      const companyMatch = bullet.position?.company.toLowerCase().includes(search)
      const titleMatch = bullet.position?.title.toLowerCase().includes(search)
      const hardSkillMatch = bullet.hard_skills?.some((s) =>
        s.toLowerCase().includes(search)
      )
      const softSkillMatch = bullet.soft_skills?.some((s) =>
        s.toLowerCase().includes(search)
      )

      return (
        textMatch ||
        categoryMatch ||
        companyMatch ||
        titleMatch ||
        hardSkillMatch ||
        softSkillMatch
      )
    })
  }, [bullets, filterText])

  if (error) {
    return (
      <div className="bullets-list bullets-list--error" data-testid="bullets-list-error">
        <p className="bullets-list__error-message">
          Failed to load bullets: {error.message}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bullets-list bullets-list--loading" data-testid="bullets-list-loading">
        <p className="bullets-list__loading-message">Loading bullets...</p>
      </div>
    )
  }

  return (
    <div className="bullets-list" data-testid="bullets-list">
      {/* Filter input */}
      <div className="bullets-list__filter">
        <input
          type="text"
          className="bullets-list__filter-input"
          placeholder="Filter bullets..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          data-testid="bullets-list-filter"
        />
        {filterText && (
          <button
            type="button"
            className="bullets-list__filter-clear"
            onClick={() => setFilterText('')}
            aria-label="Clear filter"
            data-testid="bullets-list-filter-clear"
          >
            x
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="bullets-list__count" data-testid="bullets-list-count">
        {filteredBullets.length} of {bullets.length} bullets
        {filterText && ' (filtered)'}
      </div>

      {/* Bullets list */}
      {filteredBullets.length === 0 ? (
        <div className="bullets-list__empty" data-testid="bullets-list-empty">
          {bullets.length === 0
            ? 'No bullets yet. Add some from your positions.'
            : 'No bullets match your filter.'}
        </div>
      ) : (
        <ul className="bullets-list__items" data-testid="bullets-list-items">
          {filteredBullets.map((bullet) => (
            <li
              key={bullet.id}
              className={`bullets-list__item ${
                selectedBulletId === bullet.id ? 'bullets-list__item--selected' : ''
              }`}
              data-testid={`bullet-item-${bullet.id}`}
            >
              <button
                type="button"
                className="bullets-list__item-button"
                onClick={() => onSelectBullet(bullet.id)}
                data-testid={`bullet-select-${bullet.id}`}
              >
                {/* Position context */}
                {bullet.position && (
                  <div className="bullets-list__item-context">
                    <span className="bullets-list__item-company">
                      {bullet.position.company}
                    </span>
                    <span className="bullets-list__item-title">
                      {bullet.position.title}
                    </span>
                  </div>
                )}

                {/* Bullet text (truncated) */}
                <p className="bullets-list__item-text">{bullet.current_text}</p>

                {/* Metadata row */}
                <div className="bullets-list__item-meta">
                  {bullet.category && (
                    <span className="bullets-list__item-category">{bullet.category}</span>
                  )}
                  {bullet.was_edited && (
                    <span
                      className="bullets-list__item-edited"
                      data-testid="bullet-edited-indicator"
                    >
                      Edited
                    </span>
                  )}
                </div>
              </button>

              {/* Delete button */}
              {onDeleteBullet && (
                <button
                  type="button"
                  className="bullets-list__item-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteBullet(bullet.id)
                  }}
                  aria-label={`Delete bullet`}
                  data-testid={`bullet-delete-${bullet.id}`}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
