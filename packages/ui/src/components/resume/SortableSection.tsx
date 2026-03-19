import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableBullet } from './SortableBullet'
import { SortableSubSection } from './SortableSubSection'
import type { ResumeSection, SubSectionData } from '@odie/db'

interface SortableSectionProps {
  section: ResumeSection
  bullets: Array<{
    id: string
    current_text: string
    category: string | null
    position: {
      id: string
      company: string
      title: string
    } | null
  }>
  onEditBullet: (bulletId: string) => void
  onRemoveBullet?: (bulletId: string) => void
  onEditSubSection?: (subsectionId: string, data: Partial<SubSectionData>) => void
  onDeleteSubSection?: (subsectionId: string) => void
  onAddSubSection?: () => void
  onDeleteSection?: () => void
  onRenameSection?: (newTitle: string) => void
}

export function SortableSection({
  section,
  bullets,
  onEditBullet,
  onRemoveBullet,
  onEditSubSection,
  onDeleteSubSection,
  onAddSubSection,
  onDeleteSection,
  onRenameSection,
}: SortableSectionProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(section.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleTitleClick = () => {
    if (onRenameSection) {
      setEditTitle(section.title)
      setIsEditingTitle(true)
    }
  }

  const handleTitleSave = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== section.title) {
      onRenameSection?.(trimmed)
    }
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      setEditTitle(section.title)
    }
  }

  const handleDeleteClick = () => {
    if (onDeleteSection && window.confirm(`Delete the "${section.title}" section?`)) {
      onDeleteSection()
    }
  }

  // Get bullet data for each item
  const getBulletForItem = (bulletId: string | undefined) => {
    if (!bulletId) return null
    return bullets.find((b) => b.id === bulletId)
  }

  // Get sub-section data for each item
  const getSubSectionForItem = (subsectionId: string | undefined) => {
    if (!subsectionId) return null
    return (section.subsections ?? []).find((s) => s.id === subsectionId)
  }

  // Create sortable IDs for draggable items (bullets + sub-sections)
  const itemIds = section.items
    .filter((item) => item.bulletId || item.subsectionId)
    .map((item) => (item.bulletId ?? item.subsectionId) as string)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-section ${isDragging ? 'sortable-section--dragging' : ''}`}
      data-testid={`section-${section.id}`}
    >
      <div
        className="sortable-section__header"
        {...attributes}
        {...listeners}
      >
        <span className="sortable-section__handle">&#8942;&#8942;</span>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="sortable-section__title-input"
            data-testid={`section-title-input-${section.id}`}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <h3
            className="sortable-section__title"
            data-testid={`section-title-${section.id}`}
            onClick={(e) => { e.stopPropagation(); handleTitleClick() }}
            onPointerDown={(e) => { if (onRenameSection) e.stopPropagation() }}
            title={onRenameSection ? 'Click to rename' : undefined}
            style={onRenameSection ? { cursor: 'text' } : undefined}
          >
            {section.title}
          </h3>
        )}
        {onDeleteSection && (
          <button
            type="button"
            className="sortable-section__delete-btn"
            data-testid={`delete-section-${section.id}`}
            onClick={(e) => { e.stopPropagation(); handleDeleteClick() }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Delete section"
          >
            x
          </button>
        )}
      </div>

      <div className="sortable-section__items">
        {section.items.length === 0 ? (
          <p className="sortable-section__empty">
            Drag bullets here to add them to this section
          </p>
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {section.items.map((item) => {
              if (item.type === 'subsection' && item.subsectionId) {
                const subsection = getSubSectionForItem(item.subsectionId)
                if (!subsection) return null

                return (
                  <SortableSubSection
                    key={item.subsectionId}
                    subsection={subsection}
                    onEdit={(data) => onEditSubSection?.(item.subsectionId!, data)}
                    onDelete={() => onDeleteSubSection?.(item.subsectionId!)}
                  />
                )
              }

              if (item.type === 'bullet' && item.bulletId) {
                const bullet = getBulletForItem(item.bulletId)
                if (!bullet) return null

                return (
                  <SortableBullet
                    key={item.bulletId}
                    bullet={bullet}
                    onEdit={() => onEditBullet(item.bulletId!)}
                    onRemove={onRemoveBullet ? () => onRemoveBullet(item.bulletId!) : undefined}
                  />
                )
              }
              return null
            })}
          </SortableContext>
        )}
      </div>

      {onAddSubSection && (
        <button
          type="button"
          className="sortable-section__add-subsection"
          onClick={onAddSubSection}
          data-testid={`add-subsection-${section.id}`}
          title="Add sub-section"
        >
          + Add Sub-Section
        </button>
      )}
    </div>
  )
}
