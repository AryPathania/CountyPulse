import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDisplayDate } from '@odie/shared'
import type { SubSectionData } from '@odie/db'

interface SortableSubSectionProps {
  subsection: SubSectionData
  onEdit: (data: Partial<SubSectionData>) => void
  onDelete: () => void
}

export function SortableSubSection({ subsection, onEdit, onDelete }: SortableSubSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: subsection.title,
    subtitle: subsection.subtitle ?? '',
    startDate: subsection.startDate ?? '',
    endDate: subsection.endDate ?? '',
    location: subsection.location ?? '',
  })

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

  const handleSave = () => {
    onEdit({
      title: editForm.title,
      subtitle: editForm.subtitle || undefined,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
      location: editForm.location || undefined,
    })
    setIsEditing(false)
    console.debug('[SortableSubSection] sub-section edited: %s', subsection.id)
  }

  const handleCancel = () => {
    setEditForm({
      title: subsection.title,
      subtitle: subsection.subtitle ?? '',
      startDate: subsection.startDate ?? '',
      endDate: subsection.endDate ?? '',
      location: subsection.location ?? '',
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="sortable-subsection sortable-subsection--editing"
        data-testid={`subsection-${subsection.id}`}
      >
        <div className="sortable-subsection__edit-form">
          <input
            type="text"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            placeholder="Title (e.g., Senior Engineer)"
            className="sortable-subsection__input"
            data-testid={`subsection-title-input-${subsection.id}`}
          />
          <input
            type="text"
            value={editForm.subtitle}
            onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
            placeholder="Subtitle (e.g., Company Name)"
            className="sortable-subsection__input"
            data-testid={`subsection-subtitle-input-${subsection.id}`}
          />
          <div className="sortable-subsection__date-row">
            <input
              type="text"
              value={editForm.startDate}
              onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              placeholder="Start (YYYY-MM)"
              className="sortable-subsection__input sortable-subsection__input--date"
              data-testid={`subsection-start-input-${subsection.id}`}
            />
            <span>&ndash;</span>
            <input
              type="text"
              value={editForm.endDate}
              onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
              placeholder="End (YYYY-MM or empty)"
              className="sortable-subsection__input sortable-subsection__input--date"
              data-testid={`subsection-end-input-${subsection.id}`}
            />
          </div>
          <input
            type="text"
            value={editForm.location}
            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
            placeholder="Location"
            className="sortable-subsection__input"
            data-testid={`subsection-location-input-${subsection.id}`}
          />
          <div className="sortable-subsection__edit-actions">
            <button type="button" className="btn-primary" onClick={handleSave} data-testid={`subsection-save-${subsection.id}`}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={handleCancel} data-testid={`subsection-cancel-${subsection.id}`}>
              Cancel
            </button>
          </div>
        </div>
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
          {(subsection.startDate || subsection.endDate) && (
            <span className="sortable-subsection__dates">
              {formatDisplayDate(subsection.startDate)} &ndash; {formatDisplayDate(subsection.endDate)}
            </span>
          )}
        </div>
        <div className="sortable-subsection__bottom">
          {subsection.subtitle && (
            <span className="sortable-subsection__subtitle">{subsection.subtitle}</span>
          )}
          {subsection.location && (
            <span className="sortable-subsection__location">{subsection.location}</span>
          )}
        </div>
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
