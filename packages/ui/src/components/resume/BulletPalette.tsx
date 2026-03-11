import { useState, useMemo, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import './BulletPalette.css'

export interface BulletPaletteProps {
  allBullets: Array<{
    id: string
    current_text: string
    category: string | null
    position: { company: string; title: string } | null
  }>
  usedBulletIds: Set<string>
}

interface PaletteGroup {
  key: string
  label: string
  bullets: BulletPaletteProps['allBullets']
}

function DraggableBulletItem({ bullet }: { bullet: BulletPaletteProps['allBullets'][number] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${bullet.id}`,
  })

  return (
    <div
      ref={setNodeRef}
      className={`bullet-palette__item ${isDragging ? 'bullet-palette__item--dragging' : ''}`}
      data-testid={`palette-bullet-${bullet.id}`}
      {...attributes}
      {...listeners}
    >
      <span className="bullet-palette__item-handle">&#8942;</span>
      <div className="bullet-palette__item-content">
        <p className="bullet-palette__item-text">
          {bullet.current_text.length > 80
            ? bullet.current_text.slice(0, 80) + '...'
            : bullet.current_text}
        </p>
        <div className="bullet-palette__item-meta">
          {bullet.category && (
            <span className="bullet-palette__item-category">{bullet.category}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function BulletPalette({ allBullets, usedBulletIds }: BulletPaletteProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const availableBullets = useMemo(
    () => allBullets.filter((b) => !usedBulletIds.has(b.id)),
    [allBullets, usedBulletIds]
  )

  const groups: PaletteGroup[] = useMemo(() => {
    const groupMap = new Map<string, BulletPaletteProps['allBullets']>()

    for (const bullet of availableBullets) {
      const key = bullet.position
        ? `${bullet.position.company} - ${bullet.position.title}`
        : 'Other'
      const existing = groupMap.get(key) ?? []
      existing.push(bullet)
      groupMap.set(key, existing)
    }

    return Array.from(groupMap.entries()).map(([key, bullets]) => ({
      key,
      label: key,
      bullets,
    }))
  }, [availableBullets])

  // Initialize all groups as open on first render
  useEffect(() => {
    if (openGroups.size === 0 && groups.length > 0) {
      setOpenGroups(new Set(groups.map((g) => g.key)))
    }
  }, [groups, openGroups.size])

  console.debug('[BulletPalette] %d available, %d used', availableBullets.length, usedBulletIds.size)

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="bullet-palette" data-testid="bullet-palette">
      <div
        className="bullet-palette__header"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="bullet-palette-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 className="bullet-palette__title">Available Bullets</h3>
          <span className="bullet-palette__count" data-testid="bullet-palette-count">
            {availableBullets.length}
          </span>
        </div>
        <span
          className={`bullet-palette__toggle ${isOpen ? 'bullet-palette__toggle--open' : ''}`}
        >
          &#9654;
        </span>
      </div>

      {isOpen && (
        <div className="bullet-palette__body" data-testid="bullet-palette-body">
          {availableBullets.length === 0 ? (
            <p className="bullet-palette__empty">All bullets are in use</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="bullet-palette__group" data-testid={`palette-group-${group.key}`}>
                <div
                  className="bullet-palette__group-header"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span
                    className={`bullet-palette__group-toggle ${openGroups.has(group.key) ? 'bullet-palette__group-toggle--open' : ''}`}
                  >
                    &#9654;
                  </span>
                  <span>{group.label}</span>
                  <span className="bullet-palette__group-count">({group.bullets.length})</span>
                </div>

                {openGroups.has(group.key) &&
                  group.bullets.map((bullet) => (
                    <DraggableBulletItem key={bullet.id} bullet={bullet} />
                  ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
