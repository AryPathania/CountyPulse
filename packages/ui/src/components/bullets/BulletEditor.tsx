import { useState, useEffect } from 'react'
import type { BulletWithPosition } from '@odie/db'
import './BulletEditor.css'

export interface BulletEditorProps {
  bullet: BulletWithPosition | null
  onSave: (updates: {
    current_text: string
    category?: string | null
    hard_skills?: string[] | null
    soft_skills?: string[] | null
  }) => void
  onCancel: () => void
  /** Compact mode for use in Resume Builder */
  compact?: boolean
  /** Disable editing (read-only mode) */
  disabled?: boolean
  /** Show loading state */
  saving?: boolean
}

/**
 * Reusable bullet editor component.
 * Pure controlled component - no data fetching.
 * Used in both Bullets Library and Resume Builder.
 */
export function BulletEditor({
  bullet,
  onSave,
  onCancel,
  compact = false,
  disabled = false,
  saving = false,
}: BulletEditorProps) {
  const [currentText, setCurrentText] = useState('')
  const [category, setCategory] = useState('')
  const [hardSkills, setHardSkills] = useState('')
  const [softSkills, setSoftSkills] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)

  // Sync local state when bullet changes
  useEffect(() => {
    if (bullet) {
      setCurrentText(bullet.current_text)
      setCategory(bullet.category ?? '')
      setHardSkills(bullet.hard_skills?.join(', ') ?? '')
      setSoftSkills(bullet.soft_skills?.join(', ') ?? '')
      setShowOriginal(false) // Reset show original state when bullet changes
    } else {
      setCurrentText('')
      setCategory('')
      setHardSkills('')
      setSoftSkills('')
      setShowOriginal(false)
    }
  }, [bullet])

  if (!bullet) {
    return (
      <div
        className={`bullet-editor bullet-editor--empty ${compact ? 'bullet-editor--compact' : ''}`}
        data-testid="bullet-editor-empty"
      >
        <p className="bullet-editor__placeholder">Select a bullet to edit</p>
      </div>
    )
  }

  const parseSkills = (input: string): string[] => {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  const handleSave = () => {
    onSave({
      current_text: currentText,
      category: category || null,
      hard_skills: parseSkills(hardSkills),
      soft_skills: parseSkills(softSkills),
    })
  }

  const hasChanges =
    currentText !== bullet.current_text ||
    category !== (bullet.category ?? '') ||
    hardSkills !== (bullet.hard_skills?.join(', ') ?? '') ||
    softSkills !== (bullet.soft_skills?.join(', ') ?? '')

  return (
    <div
      className={`bullet-editor ${compact ? 'bullet-editor--compact' : ''}`}
      data-testid="bullet-editor"
    >
      {/* Position context */}
      {bullet.position && !compact && (
        <div className="bullet-editor__context" data-testid="bullet-editor-context">
          <span className="bullet-editor__company">{bullet.position.company}</span>
          <span className="bullet-editor__separator"> - </span>
          <span className="bullet-editor__title">{bullet.position.title}</span>
        </div>
      )}

      {/* Edited indicator with show original toggle */}
      {bullet.was_edited && (
        <div className="bullet-editor__edited-section">
          <span className="bullet-editor__edited-badge" data-testid="bullet-edited-badge">
            Edited
          </span>
          <button
            type="button"
            className="bullet-editor__show-original-btn"
            onClick={() => setShowOriginal(!showOriginal)}
            data-testid="bullet-show-original"
          >
            {showOriginal ? 'Hide Original' : 'Show Original'}
          </button>
        </div>
      )}

      {/* Original text display (shown when toggled) */}
      {bullet.was_edited && showOriginal && (
        <div className="bullet-editor__original" data-testid="bullet-original-text">
          <span className="bullet-editor__original-label">Original:</span>
          <p className="bullet-editor__original-text">{bullet.original_text}</p>
        </div>
      )}

      {/* Main text editor */}
      <div className="bullet-editor__field">
        <label htmlFor="bullet-text" className="bullet-editor__label">
          Bullet Text
        </label>
        <textarea
          id="bullet-text"
          className="bullet-editor__textarea"
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
          disabled={disabled || saving}
          rows={compact ? 3 : 5}
          data-testid="bullet-editor-text"
        />
      </div>

      {/* Category */}
      {!compact && (
        <div className="bullet-editor__field">
          <label htmlFor="bullet-category" className="bullet-editor__label">
            Category
          </label>
          <input
            id="bullet-category"
            type="text"
            className="bullet-editor__input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={disabled || saving}
            placeholder="e.g., Leadership, Technical, Achievement"
            data-testid="bullet-editor-category"
          />
        </div>
      )}

      {/* Skills (comma-separated for MVP) */}
      {!compact && (
        <>
          <div className="bullet-editor__field">
            <label htmlFor="bullet-hard-skills" className="bullet-editor__label">
              Hard Skills (comma-separated)
            </label>
            <input
              id="bullet-hard-skills"
              type="text"
              className="bullet-editor__input"
              value={hardSkills}
              onChange={(e) => setHardSkills(e.target.value)}
              disabled={disabled || saving}
              placeholder="e.g., Python, SQL, Machine Learning"
              data-testid="bullet-editor-hard-skills"
            />
          </div>

          <div className="bullet-editor__field">
            <label htmlFor="bullet-soft-skills" className="bullet-editor__label">
              Soft Skills (comma-separated)
            </label>
            <input
              id="bullet-soft-skills"
              type="text"
              className="bullet-editor__input"
              value={softSkills}
              onChange={(e) => setSoftSkills(e.target.value)}
              disabled={disabled || saving}
              placeholder="e.g., Communication, Leadership, Problem Solving"
              data-testid="bullet-editor-soft-skills"
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="bullet-editor__actions">
        <button
          type="button"
          className="bullet-editor__btn bullet-editor__btn--secondary"
          onClick={onCancel}
          disabled={saving}
          data-testid="bullet-editor-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="bullet-editor__btn bullet-editor__btn--primary"
          onClick={handleSave}
          disabled={disabled || saving || !hasChanges}
          data-testid="bullet-editor-save"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
