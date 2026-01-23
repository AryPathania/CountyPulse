import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulletsList } from '../../../components/bullets/BulletsList'
import type { BulletWithPosition } from '@odie/db'
import { createMockBullet, TEST_USER_ID } from '../../fixtures'

const mockBullets: BulletWithPosition[] = [
  createMockBullet({
    id: 'bullet-1',
    user_id: TEST_USER_ID,
    position_id: 'position-1',
    original_text: 'Led team of 5 engineers',
    current_text: 'Led team of 5 engineers to deliver project on time',
    category: 'Leadership',
    hard_skills: ['Python', 'SQL'],
    soft_skills: ['Leadership', 'Communication'],
    was_edited: true,
    updated_at: '2024-01-02T00:00:00Z',
    position: {
      company: 'Acme Corp',
      title: 'Tech Lead',
    },
  }),
  createMockBullet({
    id: 'bullet-2',
    user_id: TEST_USER_ID,
    position_id: 'position-2',
    original_text: 'Built REST API',
    current_text: 'Built REST API serving 1M requests/day',
    category: 'Technical',
    hard_skills: ['Node.js', 'PostgreSQL'],
    soft_skills: ['Problem Solving'],
    was_edited: false,
    position: {
      company: 'TechCo',
      title: 'Backend Engineer',
    },
  }),
]

describe('BulletsList', () => {
  const mockOnSelectBullet = vi.fn()
  const mockOnDeleteBullet = vi.fn()
  const mockOnAddBullet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state', () => {
    render(
      <BulletsList
        bullets={[]}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
        loading
      />
    )

    expect(screen.getByTestId('bullets-list-loading')).toBeInTheDocument()
    expect(screen.getByText('Loading bullets...')).toBeInTheDocument()
  })

  it('should render error state', () => {
    const error = new Error('Failed to fetch')
    render(
      <BulletsList
        bullets={[]}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
        error={error}
      />
    )

    expect(screen.getByTestId('bullets-list-error')).toBeInTheDocument()
    expect(screen.getByText(/Failed to load bullets/)).toBeInTheDocument()
  })

  it('should render empty state when no bullets', () => {
    render(
      <BulletsList
        bullets={[]}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    expect(screen.getByTestId('bullets-list-empty')).toBeInTheDocument()
    expect(screen.getByText(/No bullets yet/)).toBeInTheDocument()
  })

  it('should render list of bullets', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    expect(screen.getByTestId('bullets-list-items')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-item-bullet-1')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-item-bullet-2')).toBeInTheDocument()
  })

  it('should display bullet count', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    expect(screen.getByTestId('bullets-list-count')).toHaveTextContent('2 of 2 bullets')
  })

  it('should call onSelectBullet when clicking a bullet', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    await userEvent.click(screen.getByTestId('bullet-select-bullet-1'))
    expect(mockOnSelectBullet).toHaveBeenCalledWith('bullet-1')
  })

  it('should highlight selected bullet', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId="bullet-1"
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const selectedItem = screen.getByTestId('bullet-item-bullet-1')
    expect(selectedItem).toHaveClass('bullets-list__item--selected')
  })

  it('should filter bullets by text', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const filterInput = screen.getByTestId('bullets-list-filter')
    await userEvent.type(filterInput, 'team')

    expect(screen.getByTestId('bullet-item-bullet-1')).toBeInTheDocument()
    expect(screen.queryByTestId('bullet-item-bullet-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('bullets-list-count')).toHaveTextContent('1 of 2 bullets (filtered)')
  })

  it('should filter bullets by company name', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const filterInput = screen.getByTestId('bullets-list-filter')
    await userEvent.type(filterInput, 'TechCo')

    expect(screen.queryByTestId('bullet-item-bullet-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('bullet-item-bullet-2')).toBeInTheDocument()
  })

  it('should filter bullets by skill', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const filterInput = screen.getByTestId('bullets-list-filter')
    await userEvent.type(filterInput, 'Python')

    expect(screen.getByTestId('bullet-item-bullet-1')).toBeInTheDocument()
    expect(screen.queryByTestId('bullet-item-bullet-2')).not.toBeInTheDocument()
  })

  it('should clear filter when clicking clear button', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const filterInput = screen.getByTestId('bullets-list-filter')
    await userEvent.type(filterInput, 'team')

    expect(screen.queryByTestId('bullet-item-bullet-2')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('bullets-list-filter-clear'))

    expect(screen.getByTestId('bullet-item-bullet-1')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-item-bullet-2')).toBeInTheDocument()
  })

  it('should show empty filtered state', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const filterInput = screen.getByTestId('bullets-list-filter')
    await userEvent.type(filterInput, 'nonexistent text')

    expect(screen.getByTestId('bullets-list-empty')).toBeInTheDocument()
    expect(screen.getByText(/No bullets match your filter/)).toBeInTheDocument()
  })

  it('should call onDeleteBullet when delete button is clicked', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
        onDeleteBullet={mockOnDeleteBullet}
      />
    )

    await userEvent.click(screen.getByTestId('bullet-delete-bullet-1'))
    expect(mockOnDeleteBullet).toHaveBeenCalledWith('bullet-1')
  })

  it('should show category badge', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    expect(screen.getByText('Leadership')).toBeInTheDocument()
    expect(screen.getByText('Technical')).toBeInTheDocument()
  })

  it('should show edited indicator for edited bullets', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    // bullet-1 has was_edited: true
    const bullet1 = screen.getByTestId('bullet-item-bullet-1')
    expect(bullet1).toHaveTextContent('Edited')

    // Check for the specific data-testid
    const editedIndicators = screen.getAllByTestId('bullet-edited-indicator')
    expect(editedIndicators).toHaveLength(1)
  })

  it('should not show edited indicator for unedited bullets', () => {
    // bullet-2 has was_edited: false
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    const bullet2 = screen.getByTestId('bullet-item-bullet-2')
    expect(bullet2).not.toHaveTextContent('Edited')
  })

  it('should render add bullet button when onAddBullet is provided', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
        onAddBullet={mockOnAddBullet}
      />
    )

    expect(screen.getByTestId('add-bullet-btn')).toBeInTheDocument()
  })

  it('should not render add bullet button when onAddBullet is not provided', () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
      />
    )

    expect(screen.queryByTestId('add-bullet-btn')).not.toBeInTheDocument()
  })

  it('should call onAddBullet when add button is clicked', async () => {
    render(
      <BulletsList
        bullets={mockBullets}
        selectedBulletId={null}
        onSelectBullet={mockOnSelectBullet}
        onAddBullet={mockOnAddBullet}
      />
    )

    await userEvent.click(screen.getByTestId('add-bullet-btn'))
    expect(mockOnAddBullet).toHaveBeenCalledTimes(1)
  })

  describe('draft badge', () => {
    it('renders draft badge when bullet.is_draft is true', () => {
      const draftBullets: BulletWithPosition[] = [
        createMockBullet({
          id: 'bullet-draft',
          original_text: 'Draft bullet text',
          current_text: 'Draft bullet text',
          category: 'Technical',
          hard_skills: ['React'],
          soft_skills: null,
          is_draft: true,
          position: {
            company: 'Draft Corp',
            title: 'Developer',
          },
        }),
      ]

      render(
        <BulletsList
          bullets={draftBullets}
          selectedBulletId={null}
          onSelectBullet={mockOnSelectBullet}
        />
      )

      const draftBadge = screen.getByTestId('draft-badge')
      expect(draftBadge).toBeInTheDocument()
      expect(draftBadge).toHaveTextContent('Draft')
    })

    it('does not render draft badge when bullet.is_draft is false', () => {
      const nonDraftBullets: BulletWithPosition[] = [
        createMockBullet({
          id: 'bullet-final',
          original_text: 'Final bullet text',
          current_text: 'Final bullet text',
          category: 'Technical',
          hard_skills: ['React'],
          soft_skills: null,
          is_draft: false,
          position: {
            company: 'Final Corp',
            title: 'Developer',
          },
        }),
      ]

      render(
        <BulletsList
          bullets={nonDraftBullets}
          selectedBulletId={null}
          onSelectBullet={mockOnSelectBullet}
        />
      )

      expect(screen.queryByTestId('draft-badge')).not.toBeInTheDocument()
    })

    it('shows both draft and edited badges when applicable', () => {
      const mixedBullets: BulletWithPosition[] = [
        createMockBullet({
          id: 'bullet-draft-edited',
          original_text: 'Original text',
          current_text: 'Edited text',
          category: 'Technical',
          hard_skills: null,
          soft_skills: null,
          was_edited: true,
          is_draft: true,
          updated_at: '2024-01-02T00:00:00Z',
          position: {
            company: 'Mixed Corp',
            title: 'Developer',
          },
        }),
      ]

      render(
        <BulletsList
          bullets={mixedBullets}
          selectedBulletId={null}
          onSelectBullet={mockOnSelectBullet}
        />
      )

      expect(screen.getByTestId('draft-badge')).toBeInTheDocument()
      expect(screen.getByTestId('bullet-edited-indicator')).toBeInTheDocument()
    })
  })
})
