import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { ResumeBuilderPage } from '../../pages/ResumeBuilderPage'
import type { ReactNode } from 'react'

// Capture drag handlers from DndContext for programmatic invocation
let capturedOnDragEnd: ((event: unknown) => void) | null = null
let capturedOnDragStart: ((event: unknown) => void) | null = null

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd, onDragStart }: { children: ReactNode; onDragEnd?: (event: unknown) => void; onDragStart?: (event: unknown) => void }) => {
    capturedOnDragEnd = onDragEnd ?? null
    capturedOnDragStart = onDragStart ?? null
    return children
  },
  DragOverlay: ({ children }: { children: ReactNode }) => children,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDraggable: (opts: { id: string }) => ({
    attributes: { 'data-draggable-id': opts.id },
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: 'vertical',
  useSortable: (opts: { id: string }) => ({
    attributes: { 'data-sortable-id': opts.id },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const result = [...arr]
    const [item] = result.splice(from, 1)
    result.splice(to, 0, item)
    return result
  },
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useAuth
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

// Mock resume data with subsection grouping
const mockResume = {
  id: 'resume-123',
  user_id: 'test-user-id',
  name: 'Software Engineer Resume',
  template_id: 'default',
  content: {
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        items: [
          { type: 'subsection' as const, subsectionId: 'sub-pos-1' },
          { type: 'bullet' as const, bulletId: 'bullet-1' },
          { type: 'bullet' as const, bulletId: 'bullet-2' },
          { type: 'bullet' as const, bulletId: 'bullet-4' },
        ],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
            positionId: 'pos-1',
          },
        ],
      },
      {
        id: 'skills',
        title: 'Skills',
        items: [],
      },
    ],
  },
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  parsedContent: {
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        items: [
          { type: 'subsection' as const, subsectionId: 'sub-pos-1' },
          { type: 'bullet' as const, bulletId: 'bullet-1' },
          { type: 'bullet' as const, bulletId: 'bullet-2' },
          { type: 'bullet' as const, bulletId: 'bullet-4' },
        ],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
            positionId: 'pos-1',
          },
        ],
      },
      {
        id: 'skills',
        title: 'Skills',
        items: [],
      },
    ],
  },
  bullets: [
    {
      id: 'bullet-1',
      current_text: 'Led team of 5 engineers',
      category: 'Leadership',
      position: { id: 'pos-1', company: 'Tech Corp', title: 'Lead Engineer' },
    },
    {
      id: 'bullet-2',
      current_text: 'Reduced latency by 40%',
      category: 'Backend',
      position: { id: 'pos-1', company: 'Tech Corp', title: 'Lead Engineer' },
    },
    {
      id: 'bullet-4',
      current_text: 'Designed scalable API architecture',
      category: 'Architecture',
      position: { id: 'pos-1', company: 'Tech Corp', title: 'Lead Engineer' },
    },
  ],
  positions: [
    {
      id: 'pos-1',
      company: 'Tech Corp',
      title: 'Lead Engineer',
      start_date: '2022-06-01',
      end_date: '2024-01-15',
      location: 'San Francisco, CA',
    },
  ],
  candidateInfo: {
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    headline: 'Senior Engineer',
    summary: null,
    phone: '555-000-1111',
    location: 'Austin, TX',
    links: [],
  },
}

// Mock @odie/db
const mockGetResumeWithBullets = vi.fn()
const mockUpdateResumeContent = vi.fn()
const mockLogRun = vi.fn()
const mockGetBullets = vi.fn()
const mockUpsertProfile = vi.fn()

vi.mock('@odie/db', () => ({
  getResumeWithBullets: (...args: unknown[]) => mockGetResumeWithBullets(...args),
  updateResumeContent: (...args: unknown[]) => mockUpdateResumeContent(...args),
  logRun: (...args: unknown[]) => mockLogRun(...args),
  getBullets: (...args: unknown[]) => mockGetBullets(...args),
  upsertProfile: (...args: unknown[]) => mockUpsertProfile(...args),
}))

function renderResumeBuilder(resumeId = 'resume-123') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/resumes/${resumeId}/edit`]}>
        <Routes>
          <Route path="/resumes/:id/edit" element={<ResumeBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ResumeBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    mockGetResumeWithBullets.mockResolvedValue(mockResume)
    mockUpdateResumeContent.mockResolvedValue(mockResume)
    mockLogRun.mockResolvedValue({})
    mockUpsertProfile.mockResolvedValue({})
    mockGetBullets.mockResolvedValue([
      {
        id: 'bullet-1',
        current_text: 'Led team of 5 engineers',
        category: 'Leadership',
        position: { company: 'Tech Corp', title: 'Lead Engineer' },
        user_id: 'test-user-id',
        position_id: 'pos-1',
        original_text: 'Led team of 5 engineers',
        hard_skills: null,
        soft_skills: null,
        created_at: '',
        updated_at: '',
        embedding: null,
        was_edited: null,
        is_draft: false,
      },
      {
        id: 'bullet-2',
        current_text: 'Reduced latency by 40%',
        category: 'Backend',
        position: { company: 'Tech Corp', title: 'Lead Engineer' },
        user_id: 'test-user-id',
        position_id: 'pos-1',
        original_text: 'Reduced latency by 40%',
        hard_skills: null,
        soft_skills: null,
        created_at: '',
        updated_at: '',
        embedding: null,
        was_edited: null,
        is_draft: false,
      },
      {
        id: 'bullet-3',
        current_text: 'Built CI/CD pipeline reducing deploy time by 60%',
        category: 'DevOps',
        position: { company: 'StartupXYZ', title: 'Junior Dev' },
        user_id: 'test-user-id',
        position_id: 'pos-2',
        original_text: 'Built CI/CD pipeline reducing deploy time by 60%',
        hard_skills: null,
        soft_skills: null,
        created_at: '',
        updated_at: '',
        embedding: null,
        was_edited: null,
        is_draft: false,
      },
    ])
  })

  it('should show loading state initially', () => {
    mockGetResumeWithBullets.mockReturnValue(new Promise(() => {}))

    renderResumeBuilder()

    expect(screen.getByTestId('builder-loading')).toBeInTheDocument()
  })

  it('should display resume name after loading', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      // Resume name appears in both header and preview, use getAllByText
      const titles = screen.getAllByText('Software Engineer Resume')
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should display sections', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('section-experience')).toBeInTheDocument()
      expect(screen.getByTestId('section-skills')).toBeInTheDocument()
    })
  })

  it('should display bullets in sections', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      // Bullets appear in both editor and preview, use getAllByText
      const leadBullets = screen.getAllByText('Led team of 5 engineers')
      const latencyBullets = screen.getAllByText('Reduced latency by 40%')
      expect(leadBullets.length).toBeGreaterThanOrEqual(1)
      expect(latencyBullets.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should show error state when resume not found', async () => {
    mockGetResumeWithBullets.mockResolvedValue(null)

    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('builder-error')).toBeInTheDocument()
    })

    expect(screen.getByText('Resume not found')).toBeInTheDocument()
  })

  it('should navigate back on error button click', async () => {
    mockGetResumeWithBullets.mockResolvedValue(null)

    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('builder-error')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Back to Resumes'))

    expect(mockNavigate).toHaveBeenCalledWith('/resumes')
  })

  it('should have toggle preview button', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('toggle-preview')).toBeInTheDocument()
    })
  })

  it('should toggle preview mode', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('toggle-preview')).toBeInTheDocument()
    })

    // Initially shows "Full Preview"
    expect(screen.getByText('Full Preview')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('toggle-preview'))

    // Now shows "Edit Mode"
    expect(screen.getByText('Edit Mode')).toBeInTheDocument()
  })

  it('should show preview panel', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
    })
  })

  it('should show editor panel', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('builder-editor')).toBeInTheDocument()
    })
  })

  it('should have done button', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('done-editing')).toBeInTheDocument()
    })
  })

  it('should navigate on done click', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('done-editing')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('done-editing'))

    expect(mockNavigate).toHaveBeenCalledWith('/resumes/resume-123')
  })

  it('should show edit button on bullets', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('edit-bullet-bullet-1')).toBeInTheDocument()
    })
  })

  it('should show inline editor when edit clicked', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('edit-bullet-bullet-1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('edit-bullet-bullet-1'))

    await waitFor(() => {
      expect(screen.getByTestId('inline-editor')).toBeInTheDocument()
    })
  })

  it('should display empty section message', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByText('Drag bullets here to add them to this section')).toBeInTheDocument()
    })
  })

  it('should render editor with sections after loading', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThanOrEqual(1)
    })

    // Verify editor renders with sections
    expect(screen.getByTestId('builder-editor')).toBeInTheDocument()
    expect(screen.getByTestId('section-experience')).toBeInTheDocument()
  })

  it('should show error when API throws', async () => {
    mockGetResumeWithBullets.mockRejectedValue(new Error('Network error'))

    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('builder-error')).toBeInTheDocument()
    })

    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('should close inline editor on cancel', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('edit-bullet-bullet-1')).toBeInTheDocument()
    })

    // Open inline editor
    await userEvent.click(screen.getByTestId('edit-bullet-bullet-1'))

    await waitFor(() => {
      expect(screen.getByTestId('inline-editor')).toBeInTheDocument()
    })

    // Cancel should close the editor
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByTestId('inline-editor')).not.toBeInTheDocument()
    })
  })

  it('should hide editor in full preview mode', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('builder-editor')).toBeInTheDocument()
    })

    // Click toggle to enter preview mode
    await userEvent.click(screen.getByTestId('toggle-preview'))

    // Editor should be hidden
    expect(screen.queryByTestId('builder-editor')).not.toBeInTheDocument()
    // Preview should still be visible
    expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
  })

  it('should have export PDF button', async () => {
    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument()
    })
  })

  it('should log export telemetry when export button is clicked', async () => {
    // Mock window.print
    const printMock = vi.fn()
    vi.spyOn(window, 'print').mockImplementation(printMock)

    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('export-pdf'))

    // Verify telemetry was logged
    expect(mockLogRun).toHaveBeenCalledWith({
      user_id: 'test-user-id',
      type: 'export',
      input: {
        resumeId: 'resume-123',
        resumeName: 'Software Engineer Resume',
        templateId: 'default',
        bulletCount: 3,
        sectionCount: 2,
      },
      output: { action: 'print_dialog_opened' },
      success: true,
      latency_ms: 0,
    })

    // Verify print was called
    expect(printMock).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('should not block export when telemetry logging fails', async () => {
    // Mock window.print
    const printMock = vi.fn()
    vi.spyOn(window, 'print').mockImplementation(printMock)

    // Make telemetry logging fail
    mockLogRun.mockRejectedValue(new Error('Telemetry error'))

    // Mock console.error to verify it's called
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderResumeBuilder()

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('export-pdf'))

    // Print should still be called even if telemetry fails
    expect(printMock).toHaveBeenCalled()

    // Give time for the async error to be caught
    await waitFor(() => {
      expect(consoleErrorMock).toHaveBeenCalledWith(
        'Failed to log export telemetry:',
        expect.any(Error)
      )
    })

    vi.restoreAllMocks()
  })

  describe('subsection grouping in editor', () => {
    it('should render subsection header in the experience section', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('subsection-sub-pos-1')).toBeInTheDocument()
      })

      const header = screen.getByTestId('subsection-sub-pos-1')
      expect(header).toHaveTextContent('Lead Engineer')
      expect(header).toHaveTextContent('Tech Corp')
    })

    it('should render subsection headers alongside bullets', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('subsection-sub-pos-1')).toBeInTheDocument()
      })

      // Bullets should still render next to subsection headers
      const leadBullets = screen.getAllByText('Led team of 5 engineers')
      expect(leadBullets.length).toBeGreaterThanOrEqual(1)
    })

    it('should render multiple subsections when resume has multiple grouped subsections', async () => {
      const multiSubSectionResume = {
        ...mockResume,
        parsedContent: {
          sections: [
            {
              id: 'experience',
              title: 'Experience',
              items: [
                { type: 'subsection' as const, subsectionId: 'sub-pos-1' },
                { type: 'bullet' as const, bulletId: 'bullet-1' },
                { type: 'subsection' as const, subsectionId: 'sub-pos-2' },
                { type: 'bullet' as const, bulletId: 'bullet-2' },
              ],
              subsections: [
                {
                  id: 'sub-pos-1',
                  title: 'Lead Engineer',
                  subtitle: 'Tech Corp',
                  startDate: '2022-06-01',
                  endDate: '2024-01-15',
                  location: 'San Francisco, CA',
                  positionId: 'pos-1',
                },
                {
                  id: 'sub-pos-2',
                  title: 'Junior Dev',
                  subtitle: 'StartupXYZ',
                  startDate: '2020-01-01',
                  endDate: '2022-05-01',
                  positionId: 'pos-2',
                },
              ],
            },
            {
              id: 'skills',
              title: 'Skills',
              items: [],
            },
          ],
        },
      }
      mockGetResumeWithBullets.mockResolvedValue(multiSubSectionResume)

      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('subsection-sub-pos-1')).toBeInTheDocument()
        expect(screen.getByTestId('subsection-sub-pos-2')).toBeInTheDocument()
      })

      const sub1Header = screen.getByTestId('subsection-sub-pos-1')
      expect(sub1Header).toHaveTextContent('Tech Corp')
      const sub2Header = screen.getByTestId('subsection-sub-pos-2')
      expect(sub2Header).toHaveTextContent('StartupXYZ')
    })
  })

  describe('bullet reorder preview sync', () => {
    it('should update preview bullet order after drag-and-drop reorder', async () => {
      renderResumeBuilder()

      // Wait for resume to load
      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Verify initial order in preview: bullet-1 before bullet-2
      const preview = screen.getByTestId('builder-preview')
      const initialBullets = within(preview).getAllByTestId(/^template-bullet-/)
      expect(initialBullets).toHaveLength(3)
      expect(initialBullets[0]).toHaveAttribute('data-testid', 'template-bullet-bullet-1')
      expect(initialBullets[1]).toHaveAttribute('data-testid', 'template-bullet-bullet-2')
      expect(initialBullets[2]).toHaveAttribute('data-testid', 'template-bullet-bullet-4')

      // Simulate drag-and-drop: move bullet-2 to before bullet-1
      expect(capturedOnDragEnd).not.toBeNull()
      act(() => {
        capturedOnDragEnd!({
          active: { id: 'bullet-2' },
          over: { id: 'bullet-1' },
        })
      })

      // After reorder, preview should reflect new order: bullet-2 first, bullet-1 second
      await waitFor(() => {
        const reorderedBullets = within(preview).getAllByTestId(/^template-bullet-/)
        expect(reorderedBullets[0]).toHaveAttribute('data-testid', 'template-bullet-bullet-2')
        expect(reorderedBullets[1]).toHaveAttribute('data-testid', 'template-bullet-bullet-1')
      })
    })

    it('should persist reordered content to the backend after drag-and-drop', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Simulate drag-and-drop: move bullet-2 before bullet-1
      expect(capturedOnDragEnd).not.toBeNull()
      act(() => {
        capturedOnDragEnd!({
          active: { id: 'bullet-2' },
          over: { id: 'bullet-1' },
        })
      })

      // updateResumeContent should be called with reordered sections
      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith('resume-123', {
          sections: [
            {
              id: 'experience',
              title: 'Experience',
              items: [
                { type: 'subsection', subsectionId: 'sub-pos-1' },
                { type: 'bullet', bulletId: 'bullet-2' },
                { type: 'bullet', bulletId: 'bullet-1' },
                { type: 'bullet', bulletId: 'bullet-4' },
              ],
              subsections: [
                {
                  id: 'sub-pos-1',
                  title: 'Lead Engineer',
                  subtitle: 'Tech Corp',
                  startDate: '2022-06-01',
                  endDate: '2024-01-15',
                  location: 'San Francisco, CA',
                  positionId: 'pos-1',
                },
              ],
            },
            {
              id: 'skills',
              title: 'Skills',
              items: [],
            },
          ],
        })
      })
    })

    it('should update both editor and preview bullet text after reorder', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Verify initial state: bullet text appears in preview
      const preview = screen.getByTestId('builder-preview')
      const firstBulletBefore = within(preview).getAllByTestId(/^template-bullet-/)[0]
      expect(firstBulletBefore).toHaveTextContent('Led team of 5 engineers')

      // Reorder: move bullet-2 before bullet-1
      act(() => {
        capturedOnDragEnd!({
          active: { id: 'bullet-2' },
          over: { id: 'bullet-1' },
        })
      })

      // After reorder, first bullet in preview should show bullet-2's text
      await waitFor(() => {
        const firstBulletAfter = within(preview).getAllByTestId(/^template-bullet-/)[0]
        expect(firstBulletAfter).toHaveTextContent('Reduced latency by 40%')
      })
    })

    it('should add bullet from palette to section via drag-and-drop', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Wait for palette to appear with available bullet
      await waitFor(() => {
        expect(screen.getByTestId('bullet-palette')).toBeInTheDocument()
      })

      // Simulate drag from palette onto a section
      expect(capturedOnDragEnd).not.toBeNull()
      act(() => {
        capturedOnDragEnd!({
          active: { id: 'palette-bullet-3' },
          over: { id: 'experience' },
        })
      })

      // Verify content was saved with the new bullet
      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith(
          'resume-123',
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({
                id: 'experience',
                items: expect.arrayContaining([
                  expect.objectContaining({ type: 'bullet', bulletId: 'bullet-3' }),
                ]),
              }),
            ]),
          })
        )
      })
    })

    it('should correctly move bullet DOWN by multiple positions', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Initial order: pos-1, bullet-1, bullet-2, bullet-4
      // Drag bullet-1 down to bullet-4's position
      expect(capturedOnDragEnd).not.toBeNull()
      act(() => {
        capturedOnDragEnd!({
          active: { id: 'bullet-1' },
          over: { id: 'bullet-4' },
        })
      })

      // After reorder: sub-pos-1, bullet-2, bullet-4, bullet-1
      // bullet-1 should now be AFTER bullet-4 (moved down by 2)
      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith('resume-123', {
          sections: [
            {
              id: 'experience',
              title: 'Experience',
              items: [
                { type: 'subsection', subsectionId: 'sub-pos-1' },
                { type: 'bullet', bulletId: 'bullet-2' },
                { type: 'bullet', bulletId: 'bullet-4' },
                { type: 'bullet', bulletId: 'bullet-1' },
              ],
              subsections: [
                {
                  id: 'sub-pos-1',
                  title: 'Lead Engineer',
                  subtitle: 'Tech Corp',
                  startDate: '2022-06-01',
                  endDate: '2024-01-15',
                  location: 'San Francisco, CA',
                  positionId: 'pos-1',
                },
              ],
            },
            {
              id: 'skills',
              title: 'Skills',
              items: [],
            },
          ],
        })
      })
    })

    it('should not update state when dragging bullet onto itself', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Simulate drag-and-drop onto same position (no-op)
      act(() => {
        capturedOnDragEnd!({
          active: { id: 'bullet-1' },
          over: { id: 'bullet-1' },
        })
      })

      // Order should remain unchanged
      const preview = screen.getByTestId('builder-preview')
      const bullets = within(preview).getAllByTestId(/^template-bullet-/)
      expect(bullets[0]).toHaveAttribute('data-testid', 'template-bullet-bullet-1')
      expect(bullets[1]).toHaveAttribute('data-testid', 'template-bullet-bullet-2')

      // No save call for no-op
      expect(mockUpdateResumeContent).not.toHaveBeenCalled()
    })
  })

  describe('bullet palette', () => {
    it('should render bullet palette with available bullets count', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('bullet-palette')).toBeInTheDocument()
      })

      // bullet-1 and bullet-2 are used, bullet-3 is available
      expect(screen.getByTestId('bullet-palette-count')).toHaveTextContent('1')
    })

    it('should show palette bullet that is not used in resume', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('bullet-palette')).toBeInTheDocument()
      })

      // bullet-3 is not used in the resume
      await waitFor(() => {
        expect(screen.getByTestId('palette-bullet-bullet-3')).toBeInTheDocument()
      })
    })

    it('should not show bullets already used in resume', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('bullet-palette')).toBeInTheDocument()
      })

      // bullet-1 and bullet-2 are used in the resume
      expect(screen.queryByTestId('palette-bullet-bullet-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('palette-bullet-bullet-2')).not.toBeInTheDocument()
    })
  })

  describe('sub-section CRUD', () => {
    it('should add a sub-section when add button is clicked', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThan(0)
      })

      // Click "Add Sub-Section" on the experience section
      const addBtn = screen.getByTestId('add-subsection-experience')
      await userEvent.click(addBtn)

      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith(
          'resume-123',
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({
                id: 'experience',
                subsections: expect.arrayContaining([
                  expect.objectContaining({ title: 'New Sub-Section' }),
                ]),
                items: expect.arrayContaining([
                  expect.objectContaining({ type: 'subsection' }),
                ]),
              }),
            ]),
          })
        )
      })
    })

    it('should edit a sub-section when edit is submitted', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getAllByText('Lead Engineer').length).toBeGreaterThan(0)
      })

      // Click edit button on the subsection
      const editBtn = screen.getByTestId('subsection-edit-sub-pos-1')
      await userEvent.click(editBtn)

      // Change the title in the edit form
      const titleInput = screen.getByDisplayValue('Lead Engineer')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Staff Engineer')

      // Submit the form
      const saveBtn = screen.getByTestId('subsection-save-sub-pos-1')
      await userEvent.click(saveBtn)

      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith(
          'resume-123',
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({
                id: 'experience',
                subsections: expect.arrayContaining([
                  expect.objectContaining({ id: 'sub-pos-1', title: 'Staff Engineer' }),
                ]),
              }),
            ]),
          })
        )
      })
    })

    it('should delete a sub-section when delete button is clicked', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getAllByText('Lead Engineer').length).toBeGreaterThan(0)
      })

      const deleteBtn = screen.getByTestId('subsection-delete-sub-pos-1')
      await userEvent.click(deleteBtn)

      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith(
          'resume-123',
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({
                id: 'experience',
                items: expect.not.arrayContaining([
                  expect.objectContaining({ subsectionId: 'sub-pos-1' }),
                ]),
                subsections: [],
              }),
            ]),
          })
        )
      })
    })

    it('should add a sub-section to an empty section', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThan(0)
      })

      // Click "Add Sub-Section" on the skills section (which is empty)
      const addBtn = screen.getByTestId('add-subsection-skills')
      await userEvent.click(addBtn)

      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith(
          'resume-123',
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({
                id: 'skills',
                subsections: expect.arrayContaining([
                  expect.objectContaining({ title: 'New Sub-Section' }),
                ]),
                items: expect.arrayContaining([
                  expect.objectContaining({ type: 'subsection' }),
                ]),
              }),
            ]),
          })
        )
      })
    })
  })

  describe('drag overlay', () => {
    it('should set activeId on drag start (section drag)', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Trigger drag start with a section id
      expect(capturedOnDragStart).not.toBeNull()
      act(() => {
        capturedOnDragStart!({ active: { id: 'experience' } })
      })

      // After drag start, activeId is set — overlay would show if DragOverlay rendered children
      // The DragOverlay mock renders children directly, so we verify no error was thrown
      // and the drag end clears the activeId
      act(() => {
        capturedOnDragEnd!({ active: { id: 'experience' }, over: { id: 'skills' } })
      })

      // Sections should be reordered (experience -> skills swap)
      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalled()
      })
    })

    it('should set activeId on drag start (bullet drag)', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-preview')).toBeInTheDocument()
      })

      // Trigger drag start with a bullet id
      expect(capturedOnDragStart).not.toBeNull()
      act(() => {
        capturedOnDragStart!({ active: { id: 'bullet-1' } })
      })

      // Drag end clears activeId without reorder (same id)
      act(() => {
        capturedOnDragEnd!({ active: { id: 'bullet-1' }, over: { id: 'bullet-1' } })
      })

      expect(mockUpdateResumeContent).not.toHaveBeenCalled()
    })
  })

  describe('bullet remove', () => {
    it('should show remove button on bullets', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('remove-bullet-bullet-1')).toBeInTheDocument()
      })
    })

    it('should remove bullet from section when remove is clicked', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('remove-bullet-bullet-1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('remove-bullet-bullet-1'))

      // Verify content was saved without bullet-1 in experience section
      await waitFor(() => {
        expect(mockUpdateResumeContent).toHaveBeenCalledWith(
          'resume-123',
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({
                id: 'experience',
                items: expect.not.arrayContaining([
                  expect.objectContaining({ bulletId: 'bullet-1' }),
                ]),
              }),
            ]),
          })
        )
      })
    })
  })

  describe('inline editor with null position bullet', () => {
    it('should open inline editor for a bullet with no position', async () => {
      // Override mock to include a bullet with position: null
      const resumeWithNullPositionBullet = {
        ...mockResume,
        parsedContent: {
          sections: [
            {
              id: 'experience',
              title: 'Experience',
              items: [
                { type: 'bullet' as const, bulletId: 'bullet-no-pos' },
              ],
              subsections: [],
            },
          ],
        },
        bullets: [
          {
            id: 'bullet-no-pos',
            current_text: 'Bullet without position',
            category: 'General',
            position: null,
          },
        ],
      }
      mockGetResumeWithBullets.mockResolvedValue(resumeWithNullPositionBullet)

      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('edit-bullet-bullet-no-pos')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('edit-bullet-bullet-no-pos'))

      // Inline editor should open without crashing (null position handled gracefully)
      await waitFor(() => {
        expect(screen.getByTestId('inline-editor')).toBeInTheDocument()
      })
    })
  })

  describe('PersonalInfoPanel', () => {
    it('should render personal-info-panel when resume has candidateInfo', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('personal-info-panel')).toBeInTheDocument()
      })
    })

    it('should always render personal-info-panel even when resume has no candidateInfo', async () => {
      const resumeWithoutCandidate = { ...mockResume, candidateInfo: undefined }
      mockGetResumeWithBullets.mockResolvedValue(resumeWithoutCandidate)

      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-editor')).toBeInTheDocument()
      })

      expect(screen.getByTestId('personal-info-panel')).toBeInTheDocument()
    })

    it('should always render personal-info-panel regardless of candidateInfo presence', async () => {
      // This tests the new behavior: panel always present, not gated on candidateInfo
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('builder-editor')).toBeInTheDocument()
      })

      expect(screen.getByTestId('personal-info-panel')).toBeInTheDocument()
    })

    it('should auto-expand panel on first load when displayName is empty', async () => {
      const resumeNoName = {
        ...mockResume,
        candidateInfo: { ...mockResume.candidateInfo, displayName: '' },
      }
      mockGetResumeWithBullets.mockResolvedValue(resumeNoName)

      renderResumeBuilder()

      await waitFor(() => {
        // Panel is auto-expanded — ProfileForm should be immediately visible
        expect(screen.getByTestId('profile-form')).toBeInTheDocument()
      })
    })

    it('should NOT auto-expand panel on first load when displayName is already set', async () => {
      // mockResume already has displayName: 'Jane Doe'
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('personal-info-panel')).toBeInTheDocument()
      })

      // Panel should start collapsed
      expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
    })

    it('should toggle open and close when toggle button is clicked', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('btn-toggle-personal-info')).toBeInTheDocument()
      })

      // Collapsed by default — ProfileForm should not be visible
      expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()

      // Open the panel
      await userEvent.click(screen.getByTestId('btn-toggle-personal-info'))

      await waitFor(() => {
        expect(screen.getByTestId('profile-form')).toBeInTheDocument()
      })

      // Close again
      await userEvent.click(screen.getByTestId('btn-toggle-personal-info'))

      await waitFor(() => {
        expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
      })
    })

    it('should call upsertProfile on save', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('btn-toggle-personal-info')).toBeInTheDocument()
      })

      // Open panel
      await userEvent.click(screen.getByTestId('btn-toggle-personal-info'))

      await waitFor(() => {
        expect(screen.getByTestId('profile-form')).toBeInTheDocument()
      })

      // Submit form (display name is pre-filled as 'Jane Doe')
      await userEvent.click(screen.getByTestId('btn-save-profile'))

      await waitFor(() => {
        expect(mockUpsertProfile).toHaveBeenCalledWith(
          'test-user-id',
          expect.objectContaining({ display_name: 'Jane Doe', headline: 'Senior Engineer', location: 'Austin, TX' })
        )
      })
    })

    it('should optimistically update candidateInfo displayName in local state after save', async () => {
      renderResumeBuilder()

      await waitFor(() => {
        expect(screen.getByTestId('btn-toggle-personal-info')).toBeInTheDocument()
      })

      // Open panel
      await userEvent.click(screen.getByTestId('btn-toggle-personal-info'))

      await waitFor(() => {
        expect(screen.getByTestId('input-display-name')).toBeInTheDocument()
      })

      // Change display name
      const nameInput = screen.getByTestId('input-display-name')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'John Updated')

      await userEvent.click(screen.getByTestId('btn-save-profile'))

      await waitFor(() => {
        expect(mockUpsertProfile).toHaveBeenCalledWith(
          'test-user-id',
          expect.objectContaining({ display_name: 'John Updated' })
        )
      })

      // Close and reopen — the panel should show updated value
      await userEvent.click(screen.getByTestId('btn-toggle-personal-info'))
      await userEvent.click(screen.getByTestId('btn-toggle-personal-info'))

      await waitFor(() => {
        expect(screen.getByTestId('input-display-name')).toHaveValue('John Updated')
      })
    })
  })
})
