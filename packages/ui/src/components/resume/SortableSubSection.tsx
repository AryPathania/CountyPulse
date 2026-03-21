import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDateRange } from '@odie/shared'
import type { SubSectionData } from '@odie/db'
import { SubSectionEditForm } from './SubSectionEditForm'

interface SortableSubSectionProps {
  subsection: SubSectionData
  onEdit: (data: Partial<SubSectionData>) => void
  onDelete: () => void
}

export function SortableSubSection({ subsection, onEdit, onDelete }: SortableSubSectionProps) {
  const [isEditing, setIsEditing] = useState(false)

  const hasTextItems = !!(subsection.textItems && subsection.textItems.length > 0)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subsection.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="sortable-subsection sortable-subsection--editing"
        data-testid={`subsection-${subsection.id}`}
      >
        <SubSectionEditForm
          initialData={subsection}
          onSave={(updates) => {
            onEdit(updates)
            setIsEditing(false)
            console.debug('[SortableSubSection] sub-section edited: %s', subsection.id)
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-subsection ${isDragging ? 'sortable-subsection--dragging' : ''}`}
      data-testid={`subsection-${subsection.id}`}
    >
      <div
        className="sortable-subsection__handle"
        {...attributes}
        {...listeners}
      >
        &#8942;&#8942;
      </div>

      <div className="sortable-subsection__content">
        <div className="sortable-subsection__top">
          <span className="sortable-subsection__title">{subsection.title}</span>
          {formatDateRange(subsection.startDate, subsection.endDate) && (
            <span className="sortable-subsection__dates">
              {formatDateRange(subsection.startDate, subsection.endDate)}
            </span>
          )}
        </div>
        {hasTextItems ? (
          <div className="sortable-subsection__text-items">
            {subsection.textItems!.join(', ')}
          </div>
        ) : (
          <div className="sortable-subsection__bottom">
            {subsection.subtitle && (
              <span className="sortable-subsection__subtitle">{subsection.subtitle}</span>
            )}
            {subsection.location && (
              <span className="sortable-subsection__location">{subsection.location}</span>
            )}
          </div>
        )}
      </div>

      <div className="sortable-subsection__actions">
        <button
          type="button"
          className="sortable-subsection__edit-btn"
          onClick={() => setIsEditing(true)}
          data-testid={`subsection-edit-${subsection.id}`}
          title="Edit sub-section"
        >
          &#9998;
        </button>
        <button
          type="button"
          className="sortable-subsection__delete-btn"
          onClick={() => {
            console.debug('[SortableSubSection] sub-section deleted: %s', subsection.id)
            onDelete()
          }}
          data-testid={`subsection-delete-${subsection.id}`}
          title="Delete sub-section"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
