import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassicTemplate } from '../../templates/classic_v1'
import { createMockResume } from '../fixtures'

describe('ClassicTemplate', () => {
  it('should render with data-testid template-classic', () => {
    const resume = createMockResume()
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })

  it('should display resume name in header', () => {
    const resume = createMockResume({ name: 'My Professional Resume' })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByText('My Professional Resume')).toBeInTheDocument()
  })

  it('should render sections with proper test IDs', () => {
    const resume = createMockResume()
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByTestId('template-section-experience')).toBeInTheDocument()
  })

  it('should render bullets with proper test IDs', () => {
    const resume = createMockResume()
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByTestId('template-bullet-bullet-1')).toBeInTheDocument()
    expect(screen.getByText('Led team of 5 engineers')).toBeInTheDocument()
  })

  it('should show empty state when no content', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [{ id: 'experience', title: 'Experience', items: [] }],
      },
      bullets: [],
    })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByTestId('template-empty')).toBeInTheDocument()
    expect(screen.getByText('Your resume is empty.')).toBeInTheDocument()
    expect(screen.getByText('Drag bullets into sections to build your resume.')).toBeInTheDocument()
  })

  it('should not render empty sections', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          { id: 'empty-section', title: 'Empty', items: [] },
          {
            id: 'filled-section',
            title: 'Filled',
            items: [{ type: 'bullet', bulletId: 'bullet-1' }],
          },
        ],
      },
    })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.queryByTestId('template-section-empty-section')).not.toBeInTheDocument()
    expect(screen.getByTestId('template-section-filled-section')).toBeInTheDocument()
  })

  it('should render positions with company and title', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'position', positionId: 'pos-1' }],
          },
        ],
      },
      positions: [
        {
          id: 'pos-1',
          company: 'Acme Corp',
          title: 'Senior Developer',
          start_date: '2020-01',
          end_date: '2023-06',
        },
      ],
    })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Senior Developer')).toBeInTheDocument()
    expect(screen.getByText('2020-01 - 2023-06')).toBeInTheDocument()
  })

  it('should show Present for current positions', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'position', positionId: 'pos-1' }],
          },
        ],
      },
      positions: [
        {
          id: 'pos-1',
          company: 'Current Co',
          title: 'Engineer',
          start_date: '2022-03',
          end_date: null,
        },
      ],
    })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByText('2022-03 - Present')).toBeInTheDocument()
  })

  it('should handle missing bullet gracefully', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'bullet', bulletId: 'missing-bullet' }],
          },
        ],
      },
      bullets: [],
    })
    render(<ClassicTemplate resume={resume} />)

    // Should not crash, just not render the bullet
    expect(screen.queryByTestId('template-bullet-missing-bullet')).not.toBeInTheDocument()
  })

  it('should handle missing position gracefully', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'position', positionId: 'missing-pos' }],
          },
        ],
      },
      positions: [],
    })
    render(<ClassicTemplate resume={resume} />)

    // Should not crash
    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })

  it('should use BEM class naming', () => {
    const resume = createMockResume()
    render(<ClassicTemplate resume={resume} />)

    const template = screen.getByTestId('template-classic')
    expect(template.className).toBe('classic-template')
  })
})
