import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileEntriesEditor } from '../../components/ProfileEntriesEditor'
import type { ProfileEntry } from '@odie/db'

// Mock @odie/db
const mockGetProfileEntries = vi.fn()
const mockCreateProfileEntry = vi.fn()
const mockUpdateProfileEntry = vi.fn()
const mockDeleteProfileEntry = vi.fn()

vi.mock('@odie/db', () => ({
  getProfileEntries: (...args: unknown[]) => mockGetProfileEntries(...args),
  createProfileEntry: (...args: unknown[]) => mockCreateProfileEntry(...args),
  updateProfileEntry: (...args: unknown[]) => mockUpdateProfileEntry(...args),
  deleteProfileEntry: (...args: unknown[]) => mockDeleteProfileEntry(...args),
}))

// Mock @odie/shared - provide real CATEGORY_LABELS
vi.mock('@odie/shared', () => ({
  CATEGORY_LABELS: {
    education: 'Education',
    certification: 'Certifications',
    award: 'Awards',
    project: 'Projects',
    volunteer: 'Volunteer',
  },
}))

function makeEntry(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    category: 'education',
    title: 'B.S. Computer Science',
    subtitle: 'Stanford University',
    start_date: '2018-09',
    end_date: '2022-06',
    location: 'Stanford, CA',
    text_items: [],
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderEditor(userId = 'user-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileEntriesEditor userId={userId} />
    </QueryClientProvider>
  )
}

describe('ProfileEntriesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProfileEntries.mockResolvedValue([])
  })

  it('renders all category headings', async () => {
    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('profile-entries-editor')).toBeInTheDocument()
    })

    expect(screen.getByText('Education')).toBeInTheDocument()
    expect(screen.getByText('Certifications')).toBeInTheDocument()
    expect(screen.getByText('Awards')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Volunteer')).toBeInTheDocument()
  })

  it('renders loading state initially', () => {
    // Never-resolving promise keeps loading state
    mockGetProfileEntries.mockReturnValue(new Promise(() => {}))
    renderEditor()

    expect(screen.getByTestId('entries-loading')).toBeInTheDocument()
  })

  it('shows entries under correct category', async () => {
    const entries: ProfileEntry[] = [
      makeEntry({ id: 'e1', category: 'education', title: 'B.S. CS' }),
      makeEntry({ id: 'e2', category: 'award', title: 'Best Paper Award' }),
    ]
    mockGetProfileEntries.mockResolvedValue(entries)

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('entry-e1')).toBeInTheDocument()
    })

    // Education entry under education category
    const eduCategory = screen.getByTestId('entries-category-education')
    expect(eduCategory).toHaveTextContent('B.S. CS')

    // Award entry under award category
    const awardCategory = screen.getByTestId('entries-category-award')
    expect(awardCategory).toHaveTextContent('Best Paper Award')
  })

  it('shows empty state for categories with no entries', async () => {
    mockGetProfileEntries.mockResolvedValue([])

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('profile-entries-editor')).toBeInTheDocument()
    })

    expect(screen.getByText('No education added yet.')).toBeInTheDocument()
    expect(screen.getByText('No certifications added yet.')).toBeInTheDocument()
    expect(screen.getByText('No awards added yet.')).toBeInTheDocument()
    expect(screen.getByText('No projects added yet.')).toBeInTheDocument()
    expect(screen.getByText('No volunteer added yet.')).toBeInTheDocument()
  })

  it('add button opens SubSectionEditForm', async () => {
    const user = userEvent.setup()
    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('add-entry-education')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('add-entry-education'))

    expect(screen.getByTestId('add-entry-form-education')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-form')).toBeInTheDocument()
  })

  it('edit button shows SubSectionEditForm with entry data', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ id: 'e1', title: 'B.S. CS', subtitle: 'MIT' })
    mockGetProfileEntries.mockResolvedValue([entry])

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('entry-e1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('edit-entry-e1'))

    expect(screen.getByTestId('subsection-edit-form')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-title')).toHaveValue('B.S. CS')
    expect(screen.getByTestId('subsection-edit-subtitle')).toHaveValue('MIT')
  })

  it('delete button calls deleteProfileEntry after confirm', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ id: 'e1' })
    mockGetProfileEntries.mockResolvedValue([entry])
    mockDeleteProfileEntry.mockResolvedValue(undefined)

    // Mock window.confirm to return true
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('entry-e1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-entry-e1'))

    expect(window.confirm).toHaveBeenCalledWith('Delete this entry?')
    expect(mockDeleteProfileEntry).toHaveBeenCalledWith('e1', expect.anything())
  })

  it('delete is skipped when confirm is cancelled', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ id: 'e1' })
    mockGetProfileEntries.mockResolvedValue([entry])

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('entry-e1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-entry-e1'))

    expect(window.confirm).toHaveBeenCalled()
    expect(mockDeleteProfileEntry).not.toHaveBeenCalled()
  })

  it('displays entry subtitle and dates when present', async () => {
    const entry = makeEntry({
      id: 'e1',
      title: 'B.S. CS',
      subtitle: 'Stanford',
      start_date: '2018-09',
      end_date: '2022-06',
      location: 'Stanford, CA',
    })
    mockGetProfileEntries.mockResolvedValue([entry])

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('entry-e1')).toBeInTheDocument()
    })

    const entryEl = screen.getByTestId('entry-e1')
    expect(entryEl).toHaveTextContent('Stanford')
    expect(entryEl).toHaveTextContent('2018-09')
    expect(entryEl).toHaveTextContent('2022-06')
    expect(entryEl).toHaveTextContent('Stanford, CA')
  })

  it('add button is disabled when form for that category is already open', async () => {
    const user = userEvent.setup()
    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('add-entry-education')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('add-entry-education'))

    expect(screen.getByTestId('add-entry-education')).toBeDisabled()
  })

  it('cancel on add form closes the form', async () => {
    const user = userEvent.setup()
    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('add-entry-education')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('add-entry-education'))
    expect(screen.getByTestId('add-entry-form-education')).toBeInTheDocument()

    await user.click(screen.getByTestId('subsection-edit-cancel'))
    expect(screen.queryByTestId('add-entry-form-education')).not.toBeInTheDocument()
  })

  it('save on add form calls createProfileEntry', async () => {
    const user = userEvent.setup()
    mockCreateProfileEntry.mockResolvedValue(makeEntry({ id: 'new-1' }))

    renderEditor()

    await waitFor(() => {
      expect(screen.getByTestId('add-entry-education')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('add-entry-education'))

    await user.type(screen.getByTestId('subsection-edit-title'), 'Ph.D. AI')
    await user.type(screen.getByTestId('subsection-edit-subtitle'), 'Berkeley')

    await user.click(screen.getByTestId('subsection-edit-save'))

    await waitFor(() => {
      expect(mockCreateProfileEntry).toHaveBeenCalledWith('user-1', {
        category: 'education',
        title: 'Ph.D. AI',
        subtitle: 'Berkeley',
        start_date: null,
        end_date: null,
        location: null,
        text_items: [],
      })
    })
  })
})
