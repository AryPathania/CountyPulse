import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubSectionEditForm } from '../../../components/resume/SubSectionEditForm'

describe('SubSectionEditForm', () => {
  it('renders all form fields', () => {
    render(<SubSectionEditForm onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByTestId('subsection-edit-title')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-subtitle')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-start')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-end')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-location')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-items')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-save')).toBeInTheDocument()
    expect(screen.getByTestId('subsection-edit-cancel')).toBeInTheDocument()
  })

  it('populates initial values when provided', () => {
    render(
      <SubSectionEditForm
        initialData={{
          title: 'B.S. Computer Science',
          subtitle: 'Stanford University',
          startDate: '2018-09',
          endDate: '2022-06',
          location: 'Stanford, CA',
          textItems: ['Dean\'s List', 'Honors'],
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByTestId('subsection-edit-title')).toHaveValue('B.S. Computer Science')
    expect(screen.getByTestId('subsection-edit-subtitle')).toHaveValue('Stanford University')
    expect(screen.getByTestId('subsection-edit-start')).toHaveValue('2018-09')
    expect(screen.getByTestId('subsection-edit-end')).toHaveValue('2022-06')
    expect(screen.getByTestId('subsection-edit-location')).toHaveValue('Stanford, CA')
    expect(screen.getByTestId('subsection-edit-items')).toHaveValue('Dean\'s List, Honors')
  })

  it('renders with empty values when no initialData provided', () => {
    render(<SubSectionEditForm onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByTestId('subsection-edit-title')).toHaveValue('')
    expect(screen.getByTestId('subsection-edit-subtitle')).toHaveValue('')
    expect(screen.getByTestId('subsection-edit-start')).toHaveValue('')
    expect(screen.getByTestId('subsection-edit-end')).toHaveValue('')
    expect(screen.getByTestId('subsection-edit-location')).toHaveValue('')
    expect(screen.getByTestId('subsection-edit-items')).toHaveValue('')
  })

  it('calls onSave with correct data when Save clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<SubSectionEditForm onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByTestId('subsection-edit-title'), 'M.S. Data Science')
    await user.type(screen.getByTestId('subsection-edit-subtitle'), 'MIT')
    await user.type(screen.getByTestId('subsection-edit-start'), '2022-09')
    await user.type(screen.getByTestId('subsection-edit-end'), '2024-06')
    await user.type(screen.getByTestId('subsection-edit-location'), 'Cambridge, MA')
    await user.type(screen.getByTestId('subsection-edit-items'), 'ML, NLP, Stats')

    await user.click(screen.getByTestId('subsection-edit-save'))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith({
      title: 'M.S. Data Science',
      subtitle: 'MIT',
      startDate: '2022-09',
      endDate: '2024-06',
      location: 'Cambridge, MA',
      textItems: ['ML', 'NLP', 'Stats'],
    })
  })

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<SubSectionEditForm onSave={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByTestId('subsection-edit-cancel'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('converts comma-separated textItems string to array on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<SubSectionEditForm onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByTestId('subsection-edit-title'), 'Skills')
    await user.type(screen.getByTestId('subsection-edit-items'), 'Python, React, AWS')

    await user.click(screen.getByTestId('subsection-edit-save'))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        textItems: ['Python', 'React', 'AWS'],
      })
    )
  })

  it('handles empty optional fields by converting to undefined', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<SubSectionEditForm onSave={onSave} onCancel={vi.fn()} />)

    // Only fill required title
    await user.type(screen.getByTestId('subsection-edit-title'), 'Some Title')

    await user.click(screen.getByTestId('subsection-edit-save'))

    expect(onSave).toHaveBeenCalledWith({
      title: 'Some Title',
      subtitle: undefined,
      startDate: undefined,
      endDate: undefined,
      location: undefined,
      textItems: undefined,
    })
  })

  it('trims whitespace from comma-separated items', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<SubSectionEditForm onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByTestId('subsection-edit-title'), 'Skills')
    await user.type(screen.getByTestId('subsection-edit-items'), '  Python ,  React  ,  AWS  ')

    await user.click(screen.getByTestId('subsection-edit-save'))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        textItems: ['Python', 'React', 'AWS'],
      })
    )
  })

  it('filters out empty items from comma-separated string', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<SubSectionEditForm onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByTestId('subsection-edit-title'), 'Skills')
    await user.type(screen.getByTestId('subsection-edit-items'), 'Python,,React,,')

    await user.click(screen.getByTestId('subsection-edit-save'))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        textItems: ['Python', 'React'],
      })
    )
  })
})
