import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateSelector } from '../../../components/resume/TemplateSelector'

describe('TemplateSelector', () => {
  const defaultProps = {
    selectedId: 'classic_v1',
    onSelect: vi.fn(),
  }

  it('should render with data-testid', () => {
    render(<TemplateSelector {...defaultProps} />)

    expect(screen.getByTestId('template-selector')).toBeInTheDocument()
    expect(screen.getByTestId('template-select')).toBeInTheDocument()
  })

  it('should render label', () => {
    render(<TemplateSelector {...defaultProps} />)

    expect(screen.getByText('Template:')).toBeInTheDocument()
  })

  it('should show selected template', () => {
    render(<TemplateSelector {...defaultProps} selectedId="classic_v1" />)

    const select = screen.getByTestId('template-select') as HTMLSelectElement
    expect(select.value).toBe('classic_v1')
  })

  it('should call onSelect when template changes', () => {
    const onSelect = vi.fn()
    render(<TemplateSelector {...defaultProps} onSelect={onSelect} />)

    const select = screen.getByTestId('template-select')
    fireEvent.change(select, { target: { value: 'classic_v1' } })

    expect(onSelect).toHaveBeenCalledWith('classic_v1')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<TemplateSelector {...defaultProps} disabled />)

    const select = screen.getByTestId('template-select') as HTMLSelectElement
    expect(select.disabled).toBe(true)
  })

  it('should not be disabled by default', () => {
    render(<TemplateSelector {...defaultProps} />)

    const select = screen.getByTestId('template-select') as HTMLSelectElement
    expect(select.disabled).toBe(false)
  })

  it('should list available templates', () => {
    render(<TemplateSelector {...defaultProps} />)

    // Classic template should be in the options
    expect(screen.getByRole('option', { name: 'Classic' })).toBeInTheDocument()
  })

  it('should have proper htmlFor on label', () => {
    render(<TemplateSelector {...defaultProps} />)

    const label = screen.getByText('Template:')
    expect(label).toHaveAttribute('for', 'template-select')

    const select = screen.getByTestId('template-select')
    expect(select).toHaveAttribute('id', 'template-select')
  })
})
