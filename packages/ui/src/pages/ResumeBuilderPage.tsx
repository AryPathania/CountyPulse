import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { SortableSection } from '../components/resume/SortableSection'
import { ResumePreview } from '../components/resume/ResumePreview'
import { TemplateSelector } from '../components/resume/TemplateSelector'
import { BulletEditor } from '../components/bullets'
import { DEFAULT_TEMPLATE_ID } from '../templates'
import {
  getResumeWithBullets,
  updateResumeContent,
  updateResume,
  logRun,
  type ResumeWithBullets,
  type ResumeContent,
  type ResumeSection,
} from '@odie/db'
import './ResumeBuilderPage.css'

/**
 * Resume Builder page with drag-and-drop sections and bullets.
 * Split view: left builder, right preview.
 */
export function ResumeBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [resume, setResume] = useState<ResumeWithBullets | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingBulletId, setEditingBulletId] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load resume
  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError('No resume ID provided')
        setIsLoading(false)
        return
      }

      try {
        const data = await getResumeWithBullets(id)
        if (!data) {
          setError('Resume not found')
        } else {
          setResume(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resume')
      } finally {
        setIsLoading(false)
      }
    }

    loadResume()
  }, [id])

  // Save content changes
  const saveContent = useCallback(
    async (content: ResumeContent) => {
      if (!id) return

      setIsSaving(true)
      try {
        await updateResumeContent(id, content)
      } catch (err) {
        console.error('Failed to save:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [id]
  )

  // Handle template change
  const handleTemplateChange = useCallback(
    async (templateId: string) => {
      if (!id || !resume) return

      setIsSaving(true)
      try {
        await updateResume(id, { template_id: templateId })
        setResume({ ...resume, template_id: templateId })
      } catch (err) {
        console.error('Failed to update template:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [id, resume]
  )

  // Export to PDF using browser print
  const exportToPdf = useCallback(() => {
    // Log export telemetry
    if (user?.id && resume) {
      const bulletCount = resume.parsedContent.sections.reduce(
        (count, section) => count + section.items.filter((item) => item.bulletId).length,
        0
      )

      logRun({
        user_id: user.id,
        type: 'export',
        input: {
          resumeId: resume.id,
          resumeName: resume.name,
          templateId: resume.template_id ?? DEFAULT_TEMPLATE_ID,
          bulletCount,
          sectionCount: resume.parsedContent.sections.length,
        },
        output: { action: 'print_dialog_opened' },
        success: true,
        latency_ms: 0, // Immediate action
      }).catch((err) => {
        // Don't block export on telemetry failure
        console.error('Failed to log export telemetry:', err)
      })
    }

    window.print()
  }, [user?.id, resume])

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // Handle drag end for sections
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)

      if (!over || !resume) return

      const activeIdStr = active.id as string
      const overIdStr = over.id as string

      if (activeIdStr === overIdStr) return

      // Check if we're moving sections or bullets
      const activeSection = resume.parsedContent.sections.find((s) => s.id === activeIdStr)
      const overSection = resume.parsedContent.sections.find((s) => s.id === overIdStr)

      if (activeSection && overSection) {
        // Moving sections
        const oldIndex = resume.parsedContent.sections.findIndex((s) => s.id === activeIdStr)
        const newIndex = resume.parsedContent.sections.findIndex((s) => s.id === overIdStr)

        const newSections = arrayMove(resume.parsedContent.sections, oldIndex, newIndex)
        const newContent: ResumeContent = { sections: newSections }

        setResume({ ...resume, parsedContent: newContent })
        saveContent(newContent)
      } else {
        // Moving bullets within or between sections
        handleBulletMove(activeIdStr, overIdStr)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resume, saveContent]
  )

  // Handle bullet movement
  const handleBulletMove = useCallback(
    (activeIdStr: string, overIdStr: string) => {
      if (!resume) return

      const sections = resume.parsedContent.sections

      // Find which section contains the active bullet
      let sourceSection: ResumeSection | undefined
      let sourceSectionIndex = -1
      let sourceItemIndex = -1

      for (let i = 0; i < sections.length; i++) {
        const itemIndex = sections[i].items.findIndex(
          (item) => item.bulletId === activeIdStr || item.positionId === activeIdStr
        )
        if (itemIndex !== -1) {
          sourceSection = sections[i]
          sourceSectionIndex = i
          sourceItemIndex = itemIndex
          break
        }
      }

      if (!sourceSection || sourceSectionIndex === -1) return

      // Find target location
      let targetSectionIndex = -1
      let targetItemIndex = -1

      for (let i = 0; i < sections.length; i++) {
        // Check if dropping on section itself
        if (sections[i].id === overIdStr) {
          targetSectionIndex = i
          targetItemIndex = sections[i].items.length // Add at end
          break
        }

        // Check if dropping on an item
        const itemIndex = sections[i].items.findIndex(
          (item) => item.bulletId === overIdStr || item.positionId === overIdStr
        )
        if (itemIndex !== -1) {
          targetSectionIndex = i
          targetItemIndex = itemIndex
          break
        }
      }

      if (targetSectionIndex === -1) return

      // Build new sections array
      const newSections = sections.map((section) => ({
        ...section,
        items: [...section.items],
      }))

      const [movedItem] = newSections[sourceSectionIndex].items.splice(sourceItemIndex, 1)

      // Adjust target index if same section and source was before target
      let adjustedTargetIndex = targetItemIndex
      if (sourceSectionIndex === targetSectionIndex && sourceItemIndex < targetItemIndex) {
        adjustedTargetIndex -= 1
      }

      newSections[targetSectionIndex].items.splice(adjustedTargetIndex, 0, movedItem)

      const newContent: ResumeContent = { sections: newSections }
      setResume({ ...resume, parsedContent: newContent })
      saveContent(newContent)
    },
    [resume, saveContent]
  )

  // Get bullet data by ID
  const getBulletById = useCallback(
    (bulletId: string) => {
      return resume?.bullets.find((b) => b.id === bulletId)
    },
    [resume?.bullets]
  )

  // Handle bullet edit
  const handleBulletEdit = useCallback((bulletId: string) => {
    setEditingBulletId(bulletId)
  }, [])

  // Handle bullet save
  const handleBulletSave = useCallback(() => {
    setEditingBulletId(null)
    // Refresh resume data
    if (id) {
      getResumeWithBullets(id).then((data) => {
        if (data) setResume(data)
      })
    }
  }, [id])

  // Get active item for drag overlay
  const getActiveItem = useCallback(() => {
    if (!activeId || !resume) return null

    const section = resume.parsedContent.sections.find((s) => s.id === activeId)
    if (section) {
      return { type: 'section' as const, section }
    }

    for (const section of resume.parsedContent.sections) {
      const item = section.items.find(
        (i) => i.bulletId === activeId || i.positionId === activeId
      )
      if (item) {
        const bullet = item.bulletId ? getBulletById(item.bulletId) : null
        return { type: 'bullet' as const, bullet }
      }
    }

    return null
  }, [activeId, resume, getBulletById])

  if (isLoading) {
    return (
      <div className="resume-builder" data-testid="resume-builder">
        <Navigation />
        <main className="resume-builder__main">
          <div className="resume-builder__loading" data-testid="builder-loading">
            Loading...
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="resume-builder" data-testid="resume-builder">
        <Navigation />
        <main className="resume-builder__main">
          <div className="resume-builder__error" data-testid="builder-error">
            <p>{error}</p>
            <button onClick={() => navigate('/resumes')} className="btn-primary">
              Back to Resumes
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!resume) return null

  const activeItem = getActiveItem()
  const editingBullet = editingBulletId ? getBulletById(editingBulletId) : null
  const currentTemplateId = resume.template_id ?? DEFAULT_TEMPLATE_ID

  return (
    <div className="resume-builder" data-testid="resume-builder">
      <Navigation />

      <header className="resume-builder__header">
        <div className="resume-builder__title-row">
          <h1 className="resume-builder__title">{resume.name}</h1>
          {isSaving && <span className="resume-builder__saving">Saving...</span>}
        </div>
        <div className="resume-builder__actions">
          <TemplateSelector
            selectedId={currentTemplateId}
            onSelect={handleTemplateChange}
            disabled={isSaving}
          />
          <button
            onClick={exportToPdf}
            className="btn-secondary"
            data-testid="export-pdf"
          >
            Export PDF
          </button>
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="btn-secondary"
            data-testid="toggle-preview"
          >
            {isPreviewMode ? 'Edit Mode' : 'Full Preview'}
          </button>
          <button
            onClick={() => navigate(`/resumes/${id}`)}
            className="btn-primary"
            data-testid="done-editing"
          >
            Done
          </button>
        </div>
      </header>

      <main
        className={`resume-builder__content ${isPreviewMode ? 'resume-builder__content--preview' : ''}`}
      >
        {!isPreviewMode && (
          <aside className="resume-builder__editor" data-testid="builder-editor">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={resume.parsedContent.sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {resume.parsedContent.sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    bullets={resume.bullets}
                    onEditBullet={handleBulletEdit}
                  />
                ))}
              </SortableContext>

              <DragOverlay>
                {activeItem?.type === 'section' && (
                  <div className="drag-overlay drag-overlay--section">
                    {activeItem.section.title}
                  </div>
                )}
                {activeItem?.type === 'bullet' && activeItem.bullet && (
                  <div className="drag-overlay drag-overlay--bullet">
                    {activeItem.bullet.current_text.slice(0, 50)}...
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {/* Inline bullet editor */}
            {editingBullet && (
              <div className="resume-builder__inline-editor" data-testid="inline-editor">
                <h3>Edit Bullet</h3>
                <BulletEditor
                  bullet={{
                    ...editingBullet,
                    user_id: user?.id ?? '',
                    position_id: editingBullet.position?.id ?? '',
                    original_text: editingBullet.current_text,
                    hard_skills: null,
                    soft_skills: null,
                    created_at: '',
                    updated_at: '',
                    embedding: null,
                    was_edited: null,
                    position: editingBullet.position
                      ? {
                          ...editingBullet.position,
                          location: null,
                          start_date: null,
                          end_date: null,
                          raw_notes: null,
                          user_id: user?.id ?? '',
                          created_at: '',
                          updated_at: '',
                        }
                      : null,
                  }}
                  onSave={handleBulletSave}
                  onCancel={() => setEditingBulletId(null)}
                  compact
                />
              </div>
            )}
          </aside>
        )}

        <div
          className={`resume-builder__preview ${isPreviewMode ? 'resume-builder__preview--full' : ''}`}
          data-testid="builder-preview"
        >
          <ResumePreview resume={resume} templateId={currentTemplateId} />
        </div>
      </main>
    </div>
  )
}
