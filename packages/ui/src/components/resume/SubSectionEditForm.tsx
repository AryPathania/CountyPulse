import { useState } from 'react'
import type { SubSectionData } from '@odie/db'

interface SubSectionEditFormProps {
  initialData?: Partial<SubSectionData>
  onSave: (data: Partial<SubSectionData>) => void
  onCancel: () => void
}

export function SubSectionEditForm({ initialData, onSave, onCancel }: SubSectionEditFormProps) {
  const [editForm, setEditForm] = useState({
    title: initialData?.title ?? '',
    subtitle: initialData?.subtitle ?? '',
    startDate: initialData?.startDate ?? '',
    endDate: initialData?.endDate ?? '',
    location: initialData?.location ?? '',
    textItems: initialData?.textItems?.join(', ') ?? '',
  })

  const handleSave = () => {
    const textItemsArray = editForm.textItems
      ? editForm.textItems.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    onSave({
      title: editForm.title,
      subtitle: editForm.subtitle || undefined,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
      location: editForm.location || undefined,
      textItems: textItemsArray,
    })
  }

  return (
    <div className="subsection-edit-form" data-testid="subsection-edit-form">
      <div className="edit-field">
        <label>Title</label>
        <input
          value={editForm.title}
          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          data-testid="subsection-edit-title"
          placeholder="e.g., B.S. Computer Science"
        />
      </div>
      <div className="edit-field">
        <label>Subtitle</label>
        <input
          value={editForm.subtitle}
          onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
          data-testid="subsection-edit-subtitle"
          placeholder="e.g., Stanford University"
        />
      </div>
      <div className="edit-field edit-field--row">
        <div>
          <label>Start Date</label>
          <input
            value={editForm.startDate}
            onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
            data-testid="subsection-edit-start"
            placeholder="YYYY-MM"
          />
        </div>
        <div>
          <label>End Date</label>
          <input
            value={editForm.endDate}
            onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
            data-testid="subsection-edit-end"
            placeholder="YYYY-MM or empty"
          />
        </div>
      </div>
      <div className="edit-field">
        <label>Location</label>
        <input
          value={editForm.location}
          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
          data-testid="subsection-edit-location"
          placeholder="e.g., Stanford, CA"
        />
      </div>
      <div className="edit-field">
        <label>Items (comma-separated)</label>
        <input
          value={editForm.textItems}
          onChange={(e) => setEditForm({ ...editForm, textItems: e.target.value })}
          data-testid="subsection-edit-items"
          placeholder="e.g., Python, React, AWS"
        />
      </div>
      <div className="edit-actions">
        <button onClick={handleSave} className="btn-primary btn-small" data-testid="subsection-edit-save">
          Save
        </button>
        <button onClick={onCancel} className="btn-secondary btn-small" data-testid="subsection-edit-cancel">
          Cancel
        </button>
      </div>
    </div>
  )
}
