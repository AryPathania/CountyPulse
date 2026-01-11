import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { ResumeBuilderPage } from '../../pages/ResumeBuilderPage'

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

// Mock resume data
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
          { type: 'bullet' as const, bulletId: 'bullet-1' },
          { type: 'bullet' as const, bulletId: 'bullet-2' },
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
          { type: 'bullet' as const, bulletId: 'bullet-1' },
          { type: 'bullet' as const, bulletId: 'bullet-2' },
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
  ],
  positions: [],
}

// Mock @odie/db
const mockGetResumeWithBullets = vi.fn()
const mockUpdateResumeContent = vi.fn()
const mockLogRun = vi.fn()

vi.mock('@odie/db', () => ({
  getResumeWithBullets: (...args: unknown[]) => mockGetResumeWithBullets(...args),
  updateResumeContent: (...args: unknown[]) => mockUpdateResumeContent(...args),
  logRun: (...args: unknown[]) => mockLogRun(...args),
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
        bulletCount: 2,
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
})
