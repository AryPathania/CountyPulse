import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { BulletPalette } from '../components/resume/BulletPalette'
import { ResumePreview } from '../components/resume/ResumePreview'
import { TemplateSelector } from '../components/resume/TemplateSelector'
import { BulletEditor } from '../components/bullets'
import { ProfileForm } from '../components/ProfileForm'
import { useProfileSave } from '../hooks/useProfileSave'
import { DEFAULT_TEMPLATE_ID } from '../templates'
import {
  getResumeWithBullets,
  updateResumeContent,
  updateResume,
  getBullets,
  logRun,
  type ResumeWithBullets,
  type ResumeContent,
  type ResumeSection,
  type SubSectionData,
  type BulletWithPosition,
} from '@odie/db'
import type { ProfileFormData } from '@odie/shared'
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
  const [allBullets, setAllBullets] = useState<BulletWithPosition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingBulletId, setEditingBulletId] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false)

  const userId = user?.id ?? ''
  const { save: saveProfile, isSaving: isSavingProfile } = useProfileSave(userId)

  const handleSavePersonalInfo = useCallback(
    async (data: ProfileFormData) => {
      await saveProfile(data)
      setResume((prev) =>
        prev
          ? {
              ...prev,
              candidateInfo: prev.candidateInfo
                ? {
                    ...prev.candidateInfo,
                    displayName: data.displayName,
                    headline: data.headline,
                    summary: data.summary,
                    phone: data.phone,
                    location: data.location,
                    links: data.links,
                  }
                : undefined,
            }
          : null
      )
    },
    [saveProfile]
  )

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load resume and all bullets
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
        // Fetch all user bullets for the palette
        if (user?.id) {
          const bullets = await getBullets(user.id)
          setAllBullets(bullets)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resume')
      } finally {
        setIsLoading(false)
      }
    }

    loadResume()
  }, [id, user?.id])

  // Compute which bullets are already used in the resume
  const usedBulletIds = useMemo(() => {
    if (!resume) return new Set<string>()
    const ids = new Set<string>()
    for (const section of resume.parsedContent.sections) {
      for (const item of section.items) {
        if (item.bulletId) ids.add(item.bulletId)
      }
    }
    return ids
  }, [resume])

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

  // Helper: update resume content and persist
  const applyContent = useCallback(
    (newContent: ResumeContent, overrides?: { bullets?: ResumeWithBullets['bullets'] }) => {
      if (!resume) return
      setResume({
        ...resume,
        parsedContent: newContent,
        bullets: overrides?.bullets ?? [...resume.bullets],
        positions: [...resume.positions],
      })
      saveContent(newContent)
    },
    [resume, saveContent]
  )

  // Helper: transform a single section by ID, then apply
  const updateSection = useCallback(
    (sectionId: string, transform: (section: ResumeSection) => ResumeSection, overrides?: { bullets?: ResumeWithBullets['bullets'] }) => {
      if (!resume) return
      const newSections = resume.parsedContent.sections.map((s) =>
        s.id === sectionId ? transform(s) : s
      )
      applyContent({ sections: newSections }, overrides)
    },
    [resume, applyContent]
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
          (item) => item.bulletId === activeIdStr || item.subsectionId === activeIdStr
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
          (item) => item.bulletId === overIdStr || item.subsectionId === overIdStr
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

      if (sourceSectionIndex === targetSectionIndex) {
        // Same section: use arrayMove for correct index handling
        newSections[sourceSectionIndex].items = arrayMove(
          newSections[sourceSectionIndex].items,
          sourceItemIndex,
          targetItemIndex
        )
      } else {
        // Cross-section: remove from source, insert into target
        const [movedItem] = newSections[sourceSectionIndex].items.splice(sourceItemIndex, 1)
        newSections[targetSectionIndex].items.splice(targetItemIndex, 0, movedItem)
      }

      const newContent: ResumeContent = { sections: newSections }
      applyContent(newContent)
      console.debug('[ResumeBuilder] bullet reordered, preview state updated')
    },
    [resume, applyContent]
  )

  // Handle adding a bullet from the palette to a section
  const handleAddBulletToSection = useCallback(
    (bulletId: string, sectionId: string) => {
      if (!resume) return
      // Build bullet data for the resume if not already present
      const bulletData = allBullets.find((b) => b.id === bulletId)
      const newBullets =
        bulletData && !resume.bullets.find((b) => b.id === bulletId)
          ? [
              ...resume.bullets,
              {
                id: bulletData.id,
                current_text: bulletData.current_text,
                category: bulletData.category,
                position: bulletData.position
                  ? { id: '', company: bulletData.position.company, title: bulletData.position.title }
                  : null,
              },
            ]
          : [...resume.bullets]
      updateSection(sectionId, (section) => ({
        ...section,
        items: [...section.items, { type: 'bullet' as const, bulletId }],
      }), { bullets: newBullets })
      console.debug('[ResumeBuilder] bullet added from palette to section %s', sectionId)
    },
    [resume, allBullets, updateSection]
  )

  // Handle removing a bullet from a section
  const handleRemoveBullet = useCallback(
    (bulletId: string, sectionId: string) => {
      updateSection(sectionId, (section) => ({
        ...section,
        items: section.items.filter((item) => item.bulletId !== bulletId),
      }))
      console.debug('[ResumeBuilder] bullet removed from section %s', sectionId)
    },
    [updateSection]
  )

  // Handle adding a sub-section to a section
  const handleAddSubSection = useCallback(
    (sectionId: string) => {
      const newSubSection: SubSectionData = {
        id: `sub-${crypto.randomUUID()}`,
        title: 'New Sub-Section',
      }
      updateSection(sectionId, (section) => ({
        ...section,
        subsections: [...(section.subsections ?? []), newSubSection],
        items: [...section.items, { type: 'subsection' as const, subsectionId: newSubSection.id }],
      }))
      console.debug('[ResumeBuilder] sub-section added to section %s', sectionId)
    },
    [updateSection]
  )

  // Handle editing a sub-section
  const handleEditSubSection = useCallback(
    (sectionId: string, subsectionId: string, data: Partial<SubSectionData>) => {
      updateSection(sectionId, (section) => ({
        ...section,
        subsections: (section.subsections ?? []).map((sub) =>
          sub.id === subsectionId ? { ...sub, ...data } : sub
        ),
      }))
      console.debug('[ResumeBuilder] sub-section %s edited in section %s', subsectionId, sectionId)
    },
    [updateSection]
  )

  // Handle deleting a sub-section (keeps bullets, removes header)
  const handleDeleteSubSection = useCallback(
    (sectionId: string, subsectionId: string) => {
      updateSection(sectionId, (section) => ({
        ...section,
        items: section.items.filter((item) => item.subsectionId !== subsectionId),
        subsections: (section.subsections ?? []).filter((sub) => sub.id !== subsectionId),
      }))
      console.debug('[ResumeBuilder] sub-section %s deleted from section %s', subsectionId, sectionId)
    },
    [updateSection]
  )

  // Handle drag end for sections
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)

      if (!over || !resume) return

      const activeIdStr = active.id as string
      const overIdStr = over.id as string

      if (activeIdStr === overIdStr) return

      // If dragging from palette
      if (activeIdStr.startsWith('palette-')) {
        const bulletId = activeIdStr.replace('palette-', '')
        let targetSectionId: string | undefined
        // Check if dropped on a section
        const targetSection = resume.parsedContent.sections.find((s) => s.id === overIdStr)
        if (targetSection) {
          targetSectionId = targetSection.id
        } else {
          // Dropped on a bullet - find which section contains it
          for (const section of resume.parsedContent.sections) {
            if (section.items.some((item) => item.bulletId === overIdStr || item.subsectionId === overIdStr)) {
              targetSectionId = section.id
              break
            }
          }
        }
        if (targetSectionId) {
          handleAddBulletToSection(bulletId, targetSectionId)
        }
        return
      }

      // Check if we're moving sections or bullets
      const activeSection = resume.parsedContent.sections.find((s) => s.id === activeIdStr)
      const overSection = resume.parsedContent.sections.find((s) => s.id === overIdStr)

      if (activeSection && overSection) {
        // Moving sections
        const oldIndex = resume.parsedContent.sections.findIndex((s) => s.id === activeIdStr)
        const newIndex = resume.parsedContent.sections.findIndex((s) => s.id === overIdStr)

        const newSections = arrayMove(resume.parsedContent.sections, oldIndex, newIndex)
        applyContent({ sections: newSections })
      } else {
        // Moving bullets within or between sections
        handleBulletMove(activeIdStr, overIdStr)
      }
    },
    [resume, applyContent, handleBulletMove, handleAddBulletToSection]
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

    // Check if dragging from palette
    if (activeId.startsWith('palette-')) {
      const bulletId = activeId.replace('palette-', '')
      const paletteBullet = allBullets.find((b) => b.id === bulletId)
      if (paletteBullet) {
        return {
          type: 'bullet' as const,
          bullet: {
            id: paletteBullet.id,
            current_text: paletteBullet.current_text,
            category: paletteBullet.category,
            position: paletteBullet.position
              ? { id: '', company: paletteBullet.position.company, title: paletteBullet.position.title }
              : null,
          },
        }
      }
      return null
    }

    const section = resume.parsedContent.sections.find((s) => s.id === activeId)
    if (section) {
      return { type: 'section' as const, section }
    }

    for (const section of resume.parsedContent.sections) {
      const item = section.items.find(
        (i) => i.bulletId === activeId || i.subsectionId === activeId
      )
      if (item) {
        const bullet = item.bulletId ? getBulletById(item.bulletId) : null
        return { type: 'bullet' as const, bullet }
      }
    }

    return null
  }, [activeId, resume, getBulletById, allBullets])

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
            {resume.candidateInfo && (
              <div
                className="resume-builder__personal-info-panel"
                data-testid="personal-info-panel"
              >
                <button
                  className="resume-builder__personal-info-toggle"
                  data-testid="btn-toggle-personal-info"
                  onClick={() => setIsPersonalInfoOpen((prev) => !prev)}
                  type="button"
                >
                  Personal Info {isPersonalInfoOpen ? '▼' : '▶'}
                </button>
                {isPersonalInfoOpen && (
                  <ProfileForm
                    initialData={{
                      displayName: resume.candidateInfo.displayName ?? '',
                      headline: resume.candidateInfo.headline ?? null,
                      summary: resume.candidateInfo.summary ?? null,
                      phone: resume.candidateInfo.phone ?? null,
                      location: resume.candidateInfo.location ?? null,
                      links: resume.candidateInfo.links ?? [],
                    }}
                    email={resume.candidateInfo.email ?? user?.email ?? ''}
                    isSaving={isSavingProfile}
                    onSave={handleSavePersonalInfo}
                  />
                )}
              </div>
            )}

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
                    onRemoveBullet={(bulletId) => handleRemoveBullet(bulletId, section.id)}
                    onEditSubSection={(subsectionId, data) => handleEditSubSection(section.id, subsectionId, data)}
                    onDeleteSubSection={(subsectionId) => handleDeleteSubSection(section.id, subsectionId)}
                    onAddSubSection={() => handleAddSubSection(section.id)}
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

              <BulletPalette allBullets={allBullets} usedBulletIds={usedBulletIds} />
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
