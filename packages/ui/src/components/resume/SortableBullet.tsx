import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableBulletProps {
  bullet: {
    id: string
    current_text: string
    category: string | null
    position: {
      id: string
      company: string
      title: string
    } | null
  }
  onEdit: () => void
  onRemove?: () => void
}

export function SortableBullet({ bullet, onEdit, onRemove }: SortableBulletProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bullet.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-bullet ${isDragging ? 'sortable-bullet--dragging' : ''}`}
      data-testid={`bullet-${bullet.id}`}
    >
      <div
        className="sortable-bullet__handle"
        {...attributes}
        {...listeners}
      >
        ⋮
      </div>

      <div className="sortable-bullet__content">
        <p className="sortable-bullet__text">{bullet.current_text}</p>
        <div className="sortable-bullet__meta">
          {bullet.category && (
            <span className="sortable-bullet__category">{bullet.category}</span>
          )}
          {bullet.position && (
            <span className="sortable-bullet__position">
              {bullet.position.company}
            </span>
          )}
        </div>
      </div>

      <div className="sortable-bullet__actions">
        <button
          type="button"
          className="sortable-bullet__edit"
          onClick={onEdit}
          data-testid={`edit-bullet-${bullet.id}`}
        >
          Edit
        </button>
        {onRemove && (
          <button
            type="button"
            className="sortable-bullet__remove"
            onClick={() => {
              console.debug('[SortableBullet] bullet removed from section')
              onRemove()
            }}
            data-testid={`remove-bullet-${bullet.id}`}
            title="Remove from section"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
