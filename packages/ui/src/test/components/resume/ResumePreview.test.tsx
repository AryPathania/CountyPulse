import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResumePreview } from '../../../components/resume/ResumePreview'
import { createMockResume } from '../../fixtures'

describe('ResumePreview', () => {
  it('should render resume preview container', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('resume-preview')).toBeInTheDocument()
  })

  it('should render the template component', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })

  it('should display resume name', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByText('Test Resume')).toBeInTheDocument()
  })

  it('should display sections', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('template-section-experience')).toBeInTheDocument()
    expect(screen.getByText('Experience')).toBeInTheDocument()
  })

  it('should display bullets in sections', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('template-bullet-bullet-1')).toBeInTheDocument()
    expect(screen.getByText('Led team of 5 engineers')).toBeInTheDocument()
  })

  it('should show empty state when no items', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          { id: 'experience', title: 'Experience', items: [] },
        ],
      },
      bullets: [],
    })

    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('template-empty')).toBeInTheDocument()
    expect(screen.getByText('Your resume is empty.')).toBeInTheDocument()
  })

  it('should skip empty sections', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          { id: 'experience', title: 'Experience', items: [] },
          {
            id: 'skills',
            title: 'Skills',
            items: [{ type: 'bullet', bulletId: 'bullet-1' }],
          },
        ],
      },
    })

    render(<ResumePreview resume={resume} />)

    // Experience section should not render (empty)
    expect(screen.queryByTestId('template-section-experience')).not.toBeInTheDocument()
    // Skills section should render
    expect(screen.getByTestId('template-section-skills')).toBeInTheDocument()
  })

  it('should display position info', () => {
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
          company: 'Tech Corp',
          title: 'Software Engineer',
          start_date: '2020-01',
          end_date: null,
        },
      ],
    })

    render(<ResumePreview resume={resume} />)

    expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
  })

  it('should handle missing bullet gracefully', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'bullet', bulletId: 'non-existent' }],
          },
        ],
      },
      bullets: [], // No bullets to match
    })

    render(<ResumePreview resume={resume} />)

    // Should not crash, just not render the bullet
    expect(screen.queryByTestId('template-bullet-non-existent')).not.toBeInTheDocument()
  })

  it('should use templateId prop when provided', () => {
    const resume = createMockResume({ template_id: null })
    render(<ResumePreview resume={resume} templateId="classic_v1" />)

    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })

  it('should fall back to classic_v1 for unknown template', () => {
    const resume = createMockResume({ template_id: 'unknown-template' })
    render(<ResumePreview resume={resume} />)

    // Should fall back to classic template
    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })

  it('should handle legacy default template ID', () => {
    const resume = createMockResume({ template_id: 'default' })
    render(<ResumePreview resume={resume} />)

    // default should map to classic_v1
    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })
})
