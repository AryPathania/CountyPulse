import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SortableSubSection } from '../../../components/resume/SortableSubSection'
import type { SubSectionData } from '@odie/db'

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: (opts: { id: string }) => ({
    attributes: { 'data-sortable-id': opts.id },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

const baseSubSection: SubSectionData = {
  id: 'sub-1',
  title: 'Senior Engineer',
  subtitle: 'Acme Corp',
  startDate: '2021-03-01',
  endDate: '2023-12-01',
  location: 'New York, NY',
}

describe('SortableSubSection', () => {
  const defaultProps = {
    subsection: baseSubSection,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }

  it('renders sub-section with title, subtitle, dates, and location', () => {
    render(<SortableSubSection {...defaultProps} />)

    const el = screen.getByTestId('subsection-sub-1')
    expect(el).toHaveTextContent('Senior Engineer')
    expect(el).toHaveTextContent('Acme Corp')
    expect(el).toHaveTextContent('Mar 2021')
    expect(el).toHaveTextContent('Dec 2023')
    expect(el).toHaveTextContent('New York, NY')
  })

  it('shows edit and delete buttons', () => {
    render(<SortableSubSection {...defaultProps} />)

    expect(screen.getByTestId('subsection-edit-sub-1')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-delete-sub-1')).toBeInTheDocument()
  })

  it('click edit button shows edit form with pre-filled values', () => {
    render(<SortableSubSection {...defaultProps} />)

    fireEvent.click(screen.getByTestId('subsection-edit-sub-1'))

    const titleInput = screen.getByTestId('subsection-edit-title') as HTMLInputElement
    const subtitleInput = screen.getByTestId('subsection-edit-subtitle') as HTMLInputElement
    const startInput = screen.getByTestId('subsection-edit-start') as HTMLInputElement
    const endInput = screen.getByTestId('subsection-edit-end') as HTMLInputElement
    const locationInput = screen.getByTestId('subsection-edit-location') as HTMLInputElement

    expect(titleInput.value).toBe('Senior Engineer')
    expect(subtitleInput.value).toBe('Acme Corp')
    expect(startInput.value).toBe('2021-03-01')
    expect(endInput.value).toBe('2023-12-01')
    expect(locationInput.value).toBe('New York, NY')
  })

  it('edit form save triggers onEdit callback with updated data', () => {
    const onEdit = vi.fn()
    render(<SortableSubSection {...defaultProps} onEdit={onEdit} />)

    fireEvent.click(screen.getByTestId('subsection-edit-sub-1'))

    const titleInput = screen.getByTestId('subsection-edit-title')
    fireEvent.change(titleInput, { target: { value: 'Staff Engineer' } })

    const subtitleInput = screen.getByTestId('subsection-edit-subtitle')
    fireEvent.change(subtitleInput, { target: { value: 'BigCo' } })

    fireEvent.click(screen.getByTestId('subsection-edit-save'))

    expect(onEdit).toHaveBeenCalledWith({
      title: 'Staff Engineer',
      subtitle: 'BigCo',
      startDate: '2021-03-01',
      endDate: '2023-12-01',
      location: 'New York, NY',
    })
  })

  it('edit form cancel reverts to display mode', () => {
    render(<SortableSubSection {...defaultProps} />)

    fireEvent.click(screen.getByTestId('subsection-edit-sub-1'))

    // Change title
    const titleInput = screen.getByTestId('subsection-edit-title')
    fireEvent.change(titleInput, { target: { value: 'Changed Title' } })

    // Cancel
    fireEvent.click(screen.getByTestId('subsection-edit-cancel'))

    // Should be back in display mode with original title
    expect(screen.queryByTestId('subsection-edit-title')).not.toBeInTheDocument()
    expect(screen.getByTestId('subsection-sub-1')).toHaveTextContent('Senior Engineer')
  })

  it('delete button triggers onDelete callback', () => {
    const onDelete = vi.fn()
    render(<SortableSubSection {...defaultProps} onDelete={onDelete} />)

    fireEvent.click(screen.getByTestId('subsection-delete-sub-1'))

    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('renders "Present" when endDate is empty', () => {
    const subsection: SubSectionData = {
      ...baseSubSection,
      endDate: undefined,
    }

    render(<SortableSubSection subsection={subsection} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/Present/)).toBeInTheDocument()
  })

  it('does not render dates section when neither startDate nor endDate is provided', () => {
    const subsection: SubSectionData = {
      id: 'sub-no-dates',
      title: 'Volunteer',
      subtitle: 'Nonprofit',
    }

    render(<SortableSubSection subsection={subsection} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const el = screen.getByTestId('subsection-sub-no-dates')
    expect(el.querySelector('.sortable-subsection__dates')).toBeNull()
  })

  it('edit form clears optional fields to undefined when emptied', () => {
    const onEdit = vi.fn()
    render(<SortableSubSection {...defaultProps} onEdit={onEdit} />)

    fireEvent.click(screen.getByTestId('subsection-edit-sub-1'))

    // Clear subtitle
    fireEvent.change(screen.getByTestId('subsection-edit-subtitle'), { target: { value: '' } })
    // Clear location
    fireEvent.change(screen.getByTestId('subsection-edit-location'), { target: { value: '' } })

    fireEvent.click(screen.getByTestId('subsection-edit-save'))

    expect(onEdit).toHaveBeenCalledWith({
      title: 'Senior Engineer',
      subtitle: undefined,
      startDate: '2021-03-01',
      endDate: '2023-12-01',
      location: undefined,
    })
  })
})
