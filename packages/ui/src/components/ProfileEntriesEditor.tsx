import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfileEntries, createProfileEntry, updateProfileEntry, deleteProfileEntry } from '@odie/db'
import type { ProfileEntry } from '@odie/db'
import { CATEGORY_LABELS, type ProfileEntryCategory } from '@odie/shared'
import { SubSectionEditForm } from './resume/SubSectionEditForm'
import './ProfileEntriesEditor.css'

const CATEGORIES: ProfileEntryCategory[] = ['education', 'certification', 'award', 'project', 'volunteer']

interface ProfileEntriesEditorProps {
  userId: string
}

export function ProfileEntriesEditor({ userId }: ProfileEntriesEditorProps) {
  const queryClient = useQueryClient()
  const [addingCategory, setAddingCategory] = useState<ProfileEntryCategory | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['profileEntries', userId],
    queryFn: () => getProfileEntries(userId),
  })

  const createMutation = useMutation({
    mutationFn: (entry: { category: string; title: string; subtitle?: string | null; start_date?: string | null; end_date?: string | null; location?: string | null; text_items?: string[] }) =>
      createProfileEntry(userId, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profileEntries'] })
      setAddingCategory(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<ProfileEntry, 'title' | 'subtitle' | 'start_date' | 'end_date' | 'location' | 'text_items'>> }) =>
      updateProfileEntry(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profileEntries'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProfileEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profileEntries'] }),
  })

  const groupedEntries = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = entries.filter((e) => e.category === cat)
    return acc
  }, {} as Record<ProfileEntryCategory, ProfileEntry[]>)

  if (isLoading) return <div data-testid="entries-loading">Loading entries...</div>

  return (
    <div className="profile-entries-editor" data-testid="profile-entries-editor">
      <h3>Profile Entries</h3>
      <p className="entries-subtitle">Education, certifications, awards, and more. These populate your resume sections.</p>

      {CATEGORIES.map((category) => (
        <div key={category} className="entries-category" data-testid={`entries-category-${category}`}>
          <div className="entries-category-header">
            <h4>{CATEGORY_LABELS[category]}</h4>
            <button
              className="btn-small btn-secondary"
              onClick={() => setAddingCategory(category)}
              data-testid={`add-entry-${category}`}
              disabled={addingCategory === category}
            >
              + Add
            </button>
          </div>

          {groupedEntries[category].map((entry) => (
            <div key={entry.id} className="entry-item" data-testid={`entry-${entry.id}`}>
              {editingId === entry.id ? (
                <SubSectionEditForm
                  initialData={{
                    title: entry.title,
                    subtitle: entry.subtitle ?? undefined,
                    startDate: entry.start_date ?? undefined,
                    endDate: entry.end_date ?? undefined,
                    location: entry.location ?? undefined,
                    textItems: entry.text_items.length > 0 ? entry.text_items : undefined,
                  }}
                  onSave={(data) => {
                    updateMutation.mutate({
                      id: entry.id,
                      updates: {
                        title: data.title,
                        subtitle: data.subtitle ?? null,
                        start_date: data.startDate ?? null,
                        end_date: data.endDate ?? null,
                        location: data.location ?? null,
                        text_items: data.textItems ?? [],
                      },
                    })
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="entry-display">
                  <div className="entry-info">
                    <span className="entry-title">{entry.title}</span>
                    {entry.subtitle && <span className="entry-subtitle">{entry.subtitle}</span>}
                    {(entry.start_date || entry.end_date) && (
                      <span className="entry-dates">
                        {entry.start_date ?? ''} {entry.start_date && entry.end_date ? '–' : ''} {entry.end_date ?? ''}
                      </span>
                    )}
                    {entry.location && <span className="entry-location">{entry.location}</span>}
                  </div>
                  <div className="entry-actions">
                    <button
                      onClick={() => setEditingId(entry.id)}
                      className="btn-icon"
                      data-testid={`edit-entry-${entry.id}`}
                      title="Edit"
                    >
                      &#9998;
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this entry?')) {
                          deleteMutation.mutate(entry.id)
                        }
                      }}
                      className="btn-icon btn-danger"
                      data-testid={`delete-entry-${entry.id}`}
                      title="Delete"
                    >
                      &#10005;
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {groupedEntries[category].length === 0 && addingCategory !== category && (
            <p className="entries-empty">No {CATEGORY_LABELS[category].toLowerCase()} added yet.</p>
          )}

          {addingCategory === category && (
            <div className="entry-add" data-testid={`add-entry-form-${category}`}>
              <SubSectionEditForm
                onSave={(data) => {
                  createMutation.mutate({
                    category,
                    title: data.title ?? '',
                    subtitle: data.subtitle ?? null,
                    start_date: data.startDate ?? null,
                    end_date: data.endDate ?? null,
                    location: data.location ?? null,
                    text_items: data.textItems ?? [],
                  })
                }}
                onCancel={() => setAddingCategory(null)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
