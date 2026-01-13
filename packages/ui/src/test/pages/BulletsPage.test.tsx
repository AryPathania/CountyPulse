import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { queryClient } from '../../lib/queryClient'
import { BulletsPage } from '../../pages/BulletsPage'

// Mock useAuth
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
  }),
}))

// Mock bullets with positions
const mockBullets = [
  {
    id: 'bullet-1',
    user_id: 'test-user-id',
    current_text: 'Led team of 5 engineers to deliver project on time',
    original_text: 'Led team of 5 engineers',
    category: 'Leadership',
    hard_skills: ['project management'],
    soft_skills: ['leadership'],
    position_id: 'pos-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    position: {
      id: 'pos-1',
      company: 'Tech Corp',
      title: 'Senior Engineer',
    },
  },
  {
    id: 'bullet-2',
    user_id: 'test-user-id',
    current_text: 'Reduced API latency by 40%',
    original_text: 'Reduced latency by 40%',
    category: 'Backend',
    hard_skills: ['performance optimization'],
    soft_skills: null,
    position_id: 'pos-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    position: {
      id: 'pos-1',
      company: 'Tech Corp',
      title: 'Senior Engineer',
    },
  },
]

// Mock TanStack Query hooks
const mockUpdateMutate = vi.fn()
const mockDeleteMutate = vi.fn()

vi.mock('../../queries/bullets', () => ({
  useBullets: () => ({
    data: mockBullets,
    isLoading: false,
    error: null,
  }),
  useUpdateBullet: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
  useDeleteBullet: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}))

function renderBulletsPage() {
  return render(
    <MemoryRouter initialEntries={['/bullets']}>
      <QueryClientProvider client={queryClient}>
        <BulletsPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('BulletsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('should render bullets page with header', () => {
    renderBulletsPage()

    expect(screen.getByTestId('bullets-page')).toBeInTheDocument()
    expect(screen.getByText('Bullets Library')).toBeInTheDocument()
    expect(screen.getByText('Manage and edit your resume bullet points')).toBeInTheDocument()
  })

  it('should render list panel and editor panel', () => {
    renderBulletsPage()

    expect(screen.getByTestId('bullets-list-panel')).toBeInTheDocument()
    expect(screen.getByTestId('bullets-editor-panel')).toBeInTheDocument()
  })

  it('should display bullets in the list', () => {
    renderBulletsPage()

    expect(screen.getByText('Led team of 5 engineers to deliver project on time')).toBeInTheDocument()
    expect(screen.getByText('Reduced API latency by 40%')).toBeInTheDocument()
  })

  it('should select bullet when clicked', async () => {
    renderBulletsPage()

    const bulletItem = screen.getByText('Led team of 5 engineers to deliver project on time')
    await userEvent.click(bulletItem)

    // After selection, the editor should show the selected bullet
    await waitFor(() => {
      expect(screen.getByDisplayValue('Led team of 5 engineers to deliver project on time')).toBeInTheDocument()
    })
  })

  it('should handle bullet deletion with confirmation', async () => {
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderBulletsPage()

    // Find delete button (there should be one for each bullet)
    const deleteButtons = screen.getAllByTestId(/delete-bullet/)
    await userEvent.click(deleteButtons[0])

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this bullet?')
    expect(mockDeleteMutate).toHaveBeenCalledWith('bullet-1', expect.any(Object))
  })

  it('should not delete when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderBulletsPage()

    const deleteButtons = screen.getAllByTestId(/delete-bullet/)
    await userEvent.click(deleteButtons[0])

    expect(mockDeleteMutate).not.toHaveBeenCalled()
  })

  it('should handle bullet save', async () => {
    renderBulletsPage()

    // Select a bullet first
    const bulletItem = screen.getByText('Led team of 5 engineers to deliver project on time')
    await userEvent.click(bulletItem)

    // Wait for editor to show with input
    await waitFor(() => {
      expect(screen.getByDisplayValue('Led team of 5 engineers to deliver project on time')).toBeInTheDocument()
    })

    // Make a change to enable the save button
    const textInput = screen.getByTestId('bullet-editor-text')
    await userEvent.clear(textInput)
    await userEvent.type(textInput, 'Updated bullet text')

    // Find and click save button (uses bullet-editor-save testid)
    const saveButton = screen.getByTestId('bullet-editor-save')
    await userEvent.click(saveButton)

    expect(mockUpdateMutate).toHaveBeenCalled()
  })

  it('should handle cancel edit', async () => {
    renderBulletsPage()

    // Select a bullet first
    const bulletItem = screen.getByText('Led team of 5 engineers to deliver project on time')
    await userEvent.click(bulletItem)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Led team of 5 engineers to deliver project on time')).toBeInTheDocument()
    })

    // Find and click cancel button (uses bullet-editor-cancel testid)
    const cancelButton = screen.getByTestId('bullet-editor-cancel')
    await userEvent.click(cancelButton)

    // Editor should show empty state after cancel
    await waitFor(() => {
      expect(screen.getByText('Select a bullet to edit')).toBeInTheDocument()
    })
  })
})
