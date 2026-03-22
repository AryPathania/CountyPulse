import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCorners,
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
  getProfileEntries,
  toSubSectionData,
  logRun,
  DEFAULT_SECTIONS,
  SUGGESTED_SECTIONS,
  type ResumeWithBullets,
  type ResumeContent,
  type ResumeSection,
  type SubSectionData,
  type BulletWithPosition,
  type ProfileEntry,
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
  const [profileEntries, setProfileEntries] = useState<ProfileEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingBulletId, setEditingBulletId] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false)
  const [hasAutoExpandedPersonalInfo, setHasAutoExpandedPersonalInfo] = useState(false)
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false)
  const [customSectionInput, setCustomSectionInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const addSectionRef = useRef<HTMLDivElement>(null)

  const userId = user?.id ?? ''
  const { save: saveProfile, isSaving: isSavingProfile } = useProfileSave(userId)

  const handleSavePersonalInfo = useCallback(
    async (data: ProfileFormData) => {
      await saveProfile(data)
      setResume((prev) =>
        prev
          ? {
              ...prev,
              candidateInfo: {
                ...(prev.candidateInfo ?? { email: user?.email ?? null }),
                displayName: data.displayName,
                headline: data.headline,
                summary: data.summary,
                phone: data.phone,
                location: data.location,
                links: data.links,
              },
            }
          : null
      )
    },
    [saveProfile, user?.email]
  )

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
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
        // Fetch all user bullets and profile entries for the palette
        if (user?.id) {
          const [bullets, entries] = await Promise.all([
            getBullets(user.id),
            getProfileEntries(user.id),
          ])
          setAllBullets(bullets)
          setProfileEntries(entries)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resume')
      } finally {
        setIsLoading(false)
      }
    }

    loadResume()
  }, [id, user?.id])

  // Auto-expand personal info panel if no displayName set yet
  useEffect(() => {
    if (resume && !hasAutoExpandedPersonalInfo) {
      setHasAutoExpandedPersonalInfo(true)
      if (!resume.candidateInfo?.displayName) {
        setIsPersonalInfoOpen(true)
      }
    }
  }, [resume, hasAutoExpandedPersonalInfo])

  // Persist last edited resume to localStorage for quick nav access
  useEffect(() => {
    if (id && resume?.name) {
      localStorage.setItem('lastEditedResume', JSON.stringify({ id, name: resume.name }))
    }
  }, [id, resume?.name])

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

  // Compute which profile entries are already used in the resume
  const usedEntryIds = useMemo(() => {
    if (!resume) return new Set<string>()
    const ids = new Set<string>()
    for (const section of resume.parsedContent.sections) {
      for (const item of section.items) {
        if (item.subsectionId?.startsWith('entry-')) {
          ids.add(item.subsectionId.replace('entry-', ''))
        }
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
        subsections: [...(section.subsections ?? [])],
      }))

      // Subsection group drag: move subsection + its trailing bullets as a unit
      const sourceItem = newSections[sourceSectionIndex].items[sourceItemIndex]
      const isSubsection = sourceItem.type === 'subsection'

      if (isSubsection && sourceSectionIndex === targetSectionIndex) {
        const sectionItems = newSections[sourceSectionIndex].items
        // Find group end: subsection + all consecutive non-subsection items after it
        let groupEnd = sourceItemIndex + 1
        while (groupEnd < sectionItems.length && sectionItems[groupEnd].type !== 'subsection') {
          groupEnd++
        }
        const groupSize = groupEnd - sourceItemIndex

        // Remove the group from its current position
        const group = sectionItems.splice(sourceItemIndex, groupSize)

        // Adjust target index since we removed items before splicing back in
        let adjustedTarget = targetItemIndex
        if (targetItemIndex > sourceItemIndex) {
          adjustedTarget -= groupSize
        }

        // Insert the group at the adjusted target position
        sectionItems.splice(adjustedTarget, 0, ...group)

        const newContent: ResumeContent = { sections: newSections }
        applyContent(newContent)
        return
      }

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

        // Also move subsection data if this is a subsection item
        if (movedItem.subsectionId) {
          const subIdx = newSections[sourceSectionIndex].subsections.findIndex(
            (s) => s.id === movedItem.subsectionId
          )
          if (subIdx !== -1) {
            const [movedSub] = newSections[sourceSectionIndex].subsections.splice(subIdx, 1)
            newSections[targetSectionIndex].subsections.push(movedSub)
          }
        }
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

  // Handle adding a profile entry from the palette to a section
  const handleAddEntryToSection = useCallback(
    (entryId: string, sectionId: string) => {
      if (!resume) return
      const entry = profileEntries.find((e) => e.id === entryId)
      if (!entry) return

      const subsectionData = toSubSectionData(entry)
      const newSections = resume.parsedContent.sections.map((section) => {
        if (section.id !== sectionId) return section
        return {
          ...section,
          items: [...section.items, { type: 'subsection' as const, subsectionId: subsectionData.id }],
          subsections: [...(section.subsections ?? []), subsectionData],
        }
      })
      applyContent({ sections: newSections })
      console.debug('[ResumeBuilder] entry added from palette to section %s', sectionId)
    },
    [resume, profileEntries, applyContent]
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

  // Handle adding a new section
  const handleAddSection = useCallback(
    (title: string) => {
      if (!resume) return
      const newSection: ResumeSection = {
        id: `custom-${crypto.randomUUID()}`,
        title,
        items: [],
        subsections: [],
      }
      const newContent: ResumeContent = {
        sections: [...resume.parsedContent.sections, newSection],
      }
      applyContent(newContent)
      setIsAddSectionOpen(false)
      setShowCustomInput(false)
      setCustomSectionInput('')
    },
    [resume, applyContent]
  )

  // Handle deleting a section
  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      if (!resume) return
      if (resume.parsedContent.sections.length <= 1) return
      const newContent: ResumeContent = {
        sections: resume.parsedContent.sections.filter((s) => s.id !== sectionId),
      }
      applyContent(newContent)
    },
    [resume, applyContent]
  )

  // Handle renaming a section
  const handleRenameSection = useCallback(
    (sectionId: string, newTitle: string) => {
      updateSection(sectionId, (section) => ({
        ...section,
        title: newTitle,
      }))
    },
    [updateSection]
  )

  // Close add-section dropdown on outside click
  useEffect(() => {
    if (!isAddSectionOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (addSectionRef.current && !addSectionRef.current.contains(e.target as Node)) {
        setIsAddSectionOpen(false)
        setShowCustomInput(false)
        setCustomSectionInput('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isAddSectionOpen])

  // Compute which section titles already exist (for add-section menu)
  const existingSectionTitles = useMemo(() => {
    if (!resume) return new Set<string>()
    return new Set(resume.parsedContent.sections.map((s) => s.title))
  }, [resume])

  // Handle drag end for sections
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)

      if (!over || !resume) return

      const activeIdStr = active.id as string
      const overIdStr = over.id as string

      if (activeIdStr === overIdStr) return

      // If dragging from palette, use data type discrimination
      const dragData = active.data?.current as { type: string; bulletId?: string; entryId?: string } | undefined

      const findTargetSectionId = (overId: string): string | undefined => {
        const direct = resume.parsedContent.sections.find((s) => s.id === overId)
        if (direct) return direct.id
        for (const section of resume.parsedContent.sections) {
          if (section.items.some((item) => item.bulletId === overId || item.subsectionId === overId)) {
            return section.id
          }
        }
        return undefined
      }

      if (dragData?.type === 'palette-bullet' && dragData.bulletId) {
        const targetSectionId = findTargetSectionId(overIdStr)
        if (targetSectionId) {
          handleAddBulletToSection(dragData.bulletId, targetSectionId)
        }
        return
      }

      if (dragData?.type === 'palette-entry' && dragData.entryId) {
        const targetSectionId = findTargetSectionId(overIdStr)
        if (targetSectionId) {
          handleAddEntryToSection(dragData.entryId, targetSectionId)
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
    [resume, applyContent, handleBulletMove, handleAddBulletToSection, handleAddEntryToSection]
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

    // Check if dragging from palette (bullet or entry)
    if (activeId.startsWith('palette-')) {
      // Palette bullet
      const paletteBulletId = activeId.startsWith('palette-entry-')
        ? null
        : activeId.replace('palette-', '')
      if (paletteBulletId) {
        const paletteBullet = allBullets.find((b) => b.id === paletteBulletId)
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
      }
      // Palette entry
      const entryId = activeId.startsWith('palette-entry-')
        ? activeId.replace('palette-entry-', '')
        : null
      if (entryId) {
        const entry = profileEntries.find((e) => e.id === entryId)
        if (entry) {
          return {
            type: 'entry' as const,
            entry: { id: entry.id, title: entry.title, category: entry.category },
          }
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
  }, [activeId, resume, getBulletById, allBullets, profileEntries])

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
                    displayName: resume.candidateInfo?.displayName ?? '',
                    headline: resume.candidateInfo?.headline ?? null,
                    summary: resume.candidateInfo?.summary ?? null,
                    phone: resume.candidateInfo?.phone ?? null,
                    location: resume.candidateInfo?.location ?? null,
                    links: resume.candidateInfo?.links ?? [],
                  }}
                  email={resume.candidateInfo?.email ?? user?.email ?? ''}
                  isSaving={isSavingProfile}
                  onSave={handleSavePersonalInfo}
                />
              )}
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
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
                    onDeleteSection={resume.parsedContent.sections.length > 1 ? () => handleDeleteSection(section.id) : undefined}
                    onRenameSection={(newTitle) => handleRenameSection(section.id, newTitle)}
                  />
                ))}
              </SortableContext>

              <div className="add-section" ref={addSectionRef} data-testid="add-section">
                <button
                  type="button"
                  className="add-section__trigger"
                  data-testid="add-section-btn"
                  onClick={() => setIsAddSectionOpen(!isAddSectionOpen)}
                >
                  + Add Section
                </button>
                {isAddSectionOpen && (
                  <div className="add-section__dropdown" data-testid="add-section-dropdown">
                    {/* Missing default sections */}
                    {DEFAULT_SECTIONS.filter((title) => !existingSectionTitles.has(title)).length > 0 && (
                      <>
                        <div className="add-section__group-label">Restore Default</div>
                        {DEFAULT_SECTIONS.filter((title) => !existingSectionTitles.has(title)).map((title) => (
                          <button
                            key={title}
                            type="button"
                            className="add-section__option add-section__option--default"
                            data-testid={`add-section-option-${title}`}
                            onClick={() => handleAddSection(title)}
                          >
                            {title}
                          </button>
                        ))}
                      </>
                    )}
                    {/* Suggested sections */}
                    <div className="add-section__group-label">Suggested</div>
                    {SUGGESTED_SECTIONS.filter((title) => !existingSectionTitles.has(title)).map((title) => (
                      <button
                        key={title}
                        type="button"
                        className="add-section__option"
                        data-testid={`add-section-option-${title}`}
                        onClick={() => handleAddSection(title)}
                      >
                        {title}
                      </button>
                    ))}
                    {/* Custom section input */}
                    {!showCustomInput ? (
                      <button
                        type="button"
                        className="add-section__option add-section__option--custom"
                        data-testid="add-section-custom-btn"
                        onClick={() => setShowCustomInput(true)}
                      >
                        Custom...
                      </button>
                    ) : (
                      <div className="add-section__custom-input" data-testid="add-section-custom-input">
                        <input
                          type="text"
                          placeholder="Section name"
                          value={customSectionInput}
                          onChange={(e) => setCustomSectionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customSectionInput.trim()) {
                              handleAddSection(customSectionInput.trim())
                            } else if (e.key === 'Escape') {
                              setShowCustomInput(false)
                              setCustomSectionInput('')
                            }
                          }}
                          autoFocus
                          data-testid="add-section-custom-name"
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          data-testid="add-section-custom-confirm"
                          disabled={!customSectionInput.trim()}
                          onClick={() => {
                            if (customSectionInput.trim()) {
                              handleAddSection(customSectionInput.trim())
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                {activeItem?.type === 'entry' && 'entry' in activeItem && (
                  <div className="drag-overlay drag-overlay--entry">
                    {activeItem.entry.title}
                  </div>
                )}
              </DragOverlay>

              <BulletPalette
                allBullets={allBullets}
                usedBulletIds={usedBulletIds}
                profileEntries={profileEntries.map((e) => ({
                  id: e.id,
                  category: e.category,
                  title: e.title,
                  subtitle: e.subtitle,
                  textItems: e.text_items.length > 0 ? e.text_items : undefined,
                }))}
                usedEntryIds={usedEntryIds}
              />
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
