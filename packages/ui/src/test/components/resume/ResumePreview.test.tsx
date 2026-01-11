import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResumePreview } from '../../../components/resume/ResumePreview'
import type { ResumeWithBullets } from '@odie/db'

const createMockResume = (overrides: Partial<ResumeWithBullets> = {}): ResumeWithBullets => ({
  id: 'resume-123',
  user_id: 'user-123',
  name: 'Test Resume',
  template_id: 'default',
  content: { sections: [] },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  parsedContent: {
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'bullet', bulletId: 'bullet-1' }],
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
  ],
  positions: [],
  ...overrides,
})

describe('ResumePreview', () => {
  it('should render resume preview', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('resume-preview')).toBeInTheDocument()
  })

  it('should display resume name', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByText('Test Resume')).toBeInTheDocument()
  })

  it('should display sections', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('preview-section-experience')).toBeInTheDocument()
    expect(screen.getByText('Experience')).toBeInTheDocument()
  })

  it('should display bullets in sections', () => {
    const resume = createMockResume()
    render(<ResumePreview resume={resume} />)

    expect(screen.getByTestId('preview-bullet-bullet-1')).toBeInTheDocument()
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

    expect(screen.getByTestId('preview-empty')).toBeInTheDocument()
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
    expect(screen.queryByTestId('preview-section-experience')).not.toBeInTheDocument()
    // Skills section should render
    expect(screen.getByTestId('preview-section-skills')).toBeInTheDocument()
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
    expect(screen.queryByTestId('preview-bullet-non-existent')).not.toBeInTheDocument()
  })
})
