import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableBullet } from './SortableBullet'
import type { ResumeSection } from '@odie/db'

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
}

export function SortableSection({ section, bullets, onEditBullet }: SortableSectionProps) {
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

  // Get bullet data for each item
  const getBulletForItem = (bulletId: string | undefined) => {
    if (!bulletId) return null
    return bullets.find((b) => b.id === bulletId)
  }

  // Create sortable IDs for items
  const itemIds = section.items
    .filter((item) => item.bulletId)
    .map((item) => item.bulletId as string)

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
        <span className="sortable-section__handle">⋮⋮</span>
        <h3 className="sortable-section__title">{section.title}</h3>
      </div>

      <div className="sortable-section__items">
        {section.items.length === 0 ? (
          <p className="sortable-section__empty">
            Drag bullets here to add them to this section
          </p>
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {section.items.map((item) => {
              if (item.type === 'bullet' && item.bulletId) {
                const bullet = getBulletForItem(item.bulletId)
                if (!bullet) return null

                return (
                  <SortableBullet
                    key={item.bulletId}
                    bullet={bullet}
                    onEdit={() => onEditBullet(item.bulletId!)}
                  />
                )
              }
              return null
            })}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
