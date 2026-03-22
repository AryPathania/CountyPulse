import { useState, useMemo, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import './BulletPalette.css'

export interface ProfileEntryPaletteItem {
  id: string
  category: string
  title: string
  subtitle?: string | null
  textItems?: string[]
}

export interface BulletPaletteProps {
  allBullets: Array<{
    id: string
    current_text: string
    category: string | null
    position: { company: string; title: string } | null
  }>
  usedBulletIds: Set<string>
  profileEntries?: ProfileEntryPaletteItem[]
  usedEntryIds?: Set<string>
}

interface PaletteGroup {
  key: string
  label: string
  bullets: BulletPaletteProps['allBullets']
}

function DraggablePaletteItem({
  id,
  data,
  testId,
  children,
}: {
  id: string
  data: Record<string, unknown>
  testId: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data })

  return (
    <div
      ref={setNodeRef}
      className={`bullet-palette__item ${isDragging ? 'bullet-palette__item--dragging' : ''}`}
      data-testid={testId}
      {...attributes}
      {...listeners}
    >
      <span className="bullet-palette__item-handle">&#8942;</span>
      <div className="bullet-palette__item-content">{children}</div>
    </div>
  )
}

function DraggableBulletItem({ bullet }: { bullet: BulletPaletteProps['allBullets'][number] }) {
  return (
    <DraggablePaletteItem
      id={`palette-${bullet.id}`}
      data={{ type: 'palette-bullet' as const, bulletId: bullet.id }}
      testId={`palette-bullet-${bullet.id}`}
    >
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
    </DraggablePaletteItem>
  )
}

function DraggableEntryItem({ entry }: { entry: ProfileEntryPaletteItem }) {
  return (
    <DraggablePaletteItem
      id={`palette-entry-${entry.id}`}
      data={{ type: 'palette-entry' as const, entryId: entry.id }}
      testId={`palette-entry-${entry.id}`}
    >
      <span className="bullet-palette__item-text">{entry.title}</span>
      {entry.subtitle && <span className="bullet-palette__item-meta">{entry.subtitle}</span>}
    </DraggablePaletteItem>
  )
}

export function BulletPalette({ allBullets, usedBulletIds, profileEntries, usedEntryIds }: BulletPaletteProps) {
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

  const availableEntries = useMemo(() => {
    if (!profileEntries) return []
    return profileEntries.filter((e) => !usedEntryIds?.has(e.id))
  }, [profileEntries, usedEntryIds])

  const groupedEntries = useMemo(() => {
    const grouped: Record<string, ProfileEntryPaletteItem[]> = {}
    for (const entry of availableEntries) {
      const cat = entry.category
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(entry)
    }
    return grouped
  }, [availableEntries])

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

          {availableEntries.length > 0 && (
            <div className="bullet-palette__section" data-testid="palette-entries-section">
              <h4 className="bullet-palette__section-title">Profile Entries</h4>
              {Object.entries(groupedEntries).map(([category, entries]) => (
                <div key={category} className="bullet-palette__group" data-testid={`palette-entry-group-${category}`}>
                  <div
                    className="bullet-palette__group-header"
                    onClick={() => toggleGroup(`entry-${category}`)}
                  >
                    <span
                      className={`bullet-palette__group-toggle ${openGroups.has(`entry-${category}`) ? 'bullet-palette__group-toggle--open' : ''}`}
                    >
                      &#9654;
                    </span>
                    <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    <span className="bullet-palette__group-count">({entries.length})</span>
                  </div>

                  {openGroups.has(`entry-${category}`) &&
                    entries.map((entry) => (
                      <DraggableEntryItem key={entry.id} entry={entry} />
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
