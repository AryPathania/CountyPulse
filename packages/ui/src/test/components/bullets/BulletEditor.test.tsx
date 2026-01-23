import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulletEditor } from '../../../components/bullets/BulletEditor'
import type { BulletWithPosition } from '@odie/db'
import { createMockBullet } from '../../fixtures'

const mockBullet: BulletWithPosition = createMockBullet({
  original_text: 'Original bullet text',
  current_text: 'Current bullet text',
  category: 'Leadership',
  hard_skills: ['Python', 'SQL'],
  soft_skills: ['Communication', 'Teamwork'],
  was_edited: false,
})

describe('BulletEditor', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render empty state when no bullet is provided', () => {
    render(
      <BulletEditor bullet={null} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    expect(screen.getByTestId('bullet-editor-empty')).toBeInTheDocument()
    expect(screen.getByText('Select a bullet to edit')).toBeInTheDocument()
  })

  it('should render bullet data when provided', () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    expect(screen.getByTestId('bullet-editor')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-editor-text')).toHaveValue('Current bullet text')
    expect(screen.getByTestId('bullet-editor-category')).toHaveValue('Leadership')
    expect(screen.getByTestId('bullet-editor-hard-skills')).toHaveValue('Python, SQL')
    expect(screen.getByTestId('bullet-editor-soft-skills')).toHaveValue(
      'Communication, Teamwork'
    )
  })

  it('should show position context', () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    expect(screen.getByTestId('bullet-editor-context')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
  })

  it('should show edited badge when bullet was edited', () => {
    const editedBullet = { ...mockBullet, was_edited: true }
    render(
      <BulletEditor bullet={editedBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    expect(screen.getByTestId('bullet-edited-badge')).toBeInTheDocument()
    expect(screen.getByText('Edited')).toBeInTheDocument()
  })

  it('should show "Show Original" button when bullet was edited', () => {
    const editedBullet = { ...mockBullet, was_edited: true }
    render(
      <BulletEditor bullet={editedBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    expect(screen.getByTestId('bullet-show-original')).toBeInTheDocument()
    expect(screen.getByText('Show Original')).toBeInTheDocument()
  })

  it('should toggle original text display when clicking Show Original', async () => {
    const editedBullet = {
      ...mockBullet,
      was_edited: true,
      original_text: 'Original bullet text before editing',
    }
    render(
      <BulletEditor bullet={editedBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    // Original text should not be visible initially
    expect(screen.queryByTestId('bullet-original-text')).not.toBeInTheDocument()

    // Click Show Original
    await userEvent.click(screen.getByTestId('bullet-show-original'))

    // Original text should now be visible
    expect(screen.getByTestId('bullet-original-text')).toBeInTheDocument()
    expect(screen.getByText('Original bullet text before editing')).toBeInTheDocument()
    expect(screen.getByText('Hide Original')).toBeInTheDocument()

    // Click Hide Original
    await userEvent.click(screen.getByTestId('bullet-show-original'))

    // Original text should be hidden again
    expect(screen.queryByTestId('bullet-original-text')).not.toBeInTheDocument()
    expect(screen.getByText('Show Original')).toBeInTheDocument()
  })

  it('should not show Show Original button when bullet was not edited', () => {
    const uneditedBullet = { ...mockBullet, was_edited: false }
    render(
      <BulletEditor bullet={uneditedBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    expect(screen.queryByTestId('bullet-edited-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bullet-show-original')).not.toBeInTheDocument()
  })

  it('should reset show original state when bullet changes', async () => {
    const editedBullet = {
      ...mockBullet,
      was_edited: true,
      original_text: 'Original text',
    }
    const { rerender } = render(
      <BulletEditor bullet={editedBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    // Show original text
    await userEvent.click(screen.getByTestId('bullet-show-original'))
    expect(screen.getByTestId('bullet-original-text')).toBeInTheDocument()

    // Change to a different bullet
    const newBullet = {
      ...editedBullet,
      id: 'bullet-2',
      original_text: 'Different original text',
    }
    rerender(
      <BulletEditor bullet={newBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    // Original text should be hidden (state reset)
    expect(screen.queryByTestId('bullet-original-text')).not.toBeInTheDocument()
    expect(screen.getByText('Show Original')).toBeInTheDocument()
  })

  it('should call onCancel when cancel button is clicked', async () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    const cancelButton = screen.getByTestId('bullet-editor-cancel')
    await userEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalledOnce()
  })

  it('should disable save button when no changes are made', () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    const saveButton = screen.getByTestId('bullet-editor-save')
    expect(saveButton).toBeDisabled()
  })

  it('should enable save button when changes are made', async () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    const textArea = screen.getByTestId('bullet-editor-text')
    await userEvent.clear(textArea)
    await userEvent.type(textArea, 'Updated bullet text')

    const saveButton = screen.getByTestId('bullet-editor-save')
    expect(saveButton).not.toBeDisabled()
  })

  it('should call onSave with updated values', async () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    const textArea = screen.getByTestId('bullet-editor-text')
    await userEvent.clear(textArea)
    await userEvent.type(textArea, 'Updated bullet text')

    const saveButton = screen.getByTestId('bullet-editor-save')
    await userEvent.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith({
      current_text: 'Updated bullet text',
      category: 'Leadership',
      hard_skills: ['Python', 'SQL'],
      soft_skills: ['Communication', 'Teamwork'],
    })
  })

  it('should hide fields in compact mode', () => {
    render(
      <BulletEditor
        bullet={mockBullet}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        compact
      />
    )

    expect(screen.getByTestId('bullet-editor-text')).toBeInTheDocument()
    expect(screen.queryByTestId('bullet-editor-category')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bullet-editor-hard-skills')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bullet-editor-soft-skills')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bullet-editor-context')).not.toBeInTheDocument()
  })

  it('should show saving state', () => {
    render(
      <BulletEditor
        bullet={mockBullet}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        saving
      />
    )

    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-editor-text')).toBeDisabled()
  })

  it('should parse comma-separated skills correctly', async () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    const hardSkillsInput = screen.getByTestId('bullet-editor-hard-skills')
    await userEvent.clear(hardSkillsInput)
    await userEvent.type(hardSkillsInput, 'React, TypeScript, Node.js')

    const saveButton = screen.getByTestId('bullet-editor-save')
    await userEvent.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        hard_skills: ['React', 'TypeScript', 'Node.js'],
      })
    )
  })

  it('should handle empty skills gracefully', async () => {
    render(
      <BulletEditor bullet={mockBullet} onSave={mockOnSave} onCancel={mockOnCancel} />
    )

    const hardSkillsInput = screen.getByTestId('bullet-editor-hard-skills')
    await userEvent.clear(hardSkillsInput)

    const textArea = screen.getByTestId('bullet-editor-text')
    await userEvent.clear(textArea)
    await userEvent.type(textArea, 'New text')

    const saveButton = screen.getByTestId('bullet-editor-save')
    await userEvent.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        hard_skills: [],
      })
    )
  })
})
