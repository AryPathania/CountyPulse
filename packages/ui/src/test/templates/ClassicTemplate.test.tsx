import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassicTemplate } from '../../templates/classic_v1'
import { createMockResume, createMockCandidateInfo } from '../fixtures'

describe('ClassicTemplate', () => {
  it('should render with data-testid template-classic', () => {
    const resume = createMockResume()
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByTestId('template-classic')).toBeInTheDocument()
  })

  describe('placeholder name behavior', () => {
    it('should render "Your Name" with placeholder class when candidateInfo.displayName is empty', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo({ displayName: '' }),
      })
      render(<ClassicTemplate resume={resume} />)

      const nameEl = screen.getByText('Your Name')
      expect(nameEl).toBeInTheDocument()
      expect(nameEl).toHaveClass('classic-template__name--placeholder')
    })

    it('should render real displayName without placeholder class when displayName is set', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo({ displayName: 'Alice Smith' }),
      })
      render(<ClassicTemplate resume={resume} />)

      const nameEl = screen.getByText('Alice Smith')
      expect(nameEl).toBeInTheDocument()
      expect(nameEl).not.toHaveClass('classic-template__name--placeholder')
      expect(screen.queryByText('Your Name')).not.toBeInTheDocument()
    })

    it('should render "Your Name" with placeholder class when candidateInfo is absent', () => {
      const resume = createMockResume()
      delete (resume as Record<string, unknown>).candidateInfo
      render(<ClassicTemplate resume={resume} />)

      const nameEl = screen.getByText('Your Name')
      expect(nameEl).toBeInTheDocument()
      expect(nameEl).toHaveClass('classic-template__name--placeholder')
    })
  })

  it('should display candidateInfo.displayName in header when set', () => {
    const resume = createMockResume({
      name: 'My Professional Resume',
      candidateInfo: createMockCandidateInfo({ displayName: 'My Professional Resume' }),
    })
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

  it('should render subsections with company and title', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'subsection', subsectionId: 'sub-pos-1' }],
            subsections: [
              {
                id: 'sub-pos-1',
                title: 'Senior Developer',
                subtitle: 'Acme Corp',
                startDate: '2020-01',
                endDate: '2023-06',
                positionId: 'pos-1',
              },
            ],
          },
        ],
      },
    })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Senior Developer')).toBeInTheDocument()
    expect(screen.getByText('Jan 2020 - Jun 2023')).toBeInTheDocument()
  })

  it('should show Present for current subsections', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'subsection', subsectionId: 'sub-pos-1' }],
            subsections: [
              {
                id: 'sub-pos-1',
                title: 'Engineer',
                subtitle: 'Current Co',
                startDate: '2022-03',
                positionId: 'pos-1',
              },
            ],
          },
        ],
      },
    })
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByText('Mar 2022 - Present')).toBeInTheDocument()
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

  it('should handle missing subsection gracefully', () => {
    const resume = createMockResume({
      parsedContent: {
        sections: [
          {
            id: 'experience',
            title: 'Experience',
            items: [{ type: 'subsection', subsectionId: 'sub-missing-pos' }],
          },
        ],
      },
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

  describe('candidate info header', () => {
    it('should render candidateInfo.displayName instead of resume.name when candidateInfo is present', () => {
      const resume = createMockResume({
        name: 'My Resume',
        candidateInfo: createMockCandidateInfo({ displayName: 'Jane Doe' }),
      })
      render(<ClassicTemplate resume={resume} />)

      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
      expect(screen.queryByText('My Resume')).not.toBeInTheDocument()
    })

    it('should render contact line with email, links, phone separated by dots', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo(),
      })
      render(<ClassicTemplate resume={resume} />)

      const contactEl = screen.getByTestId('template-contact')
      expect(contactEl).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByText('LinkedIn')).toBeInTheDocument()
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument()

      // LinkedIn and GitHub should be links
      const linkedinLink = screen.getByText('LinkedIn').closest('a')
      expect(linkedinLink).toHaveAttribute('href', 'https://linkedin.com/in/janedoe')
      const githubLink = screen.getByText('GitHub').closest('a')
      expect(githubLink).toHaveAttribute('href', 'https://github.com/janedoe')

      // Separators (dot separators) should be present
      const separators = contactEl.querySelectorAll('.classic-template__separator')
      expect(separators.length).toBeGreaterThan(0)
    })

    it('should render location when present', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo({ location: 'San Francisco, CA' }),
      })
      render(<ClassicTemplate resume={resume} />)

      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument()
    })

    it('should render summary when present', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo({
          summary: 'Experienced engineer with 10 years in full-stack development.',
        }),
      })
      render(<ClassicTemplate resume={resume} />)

      expect(
        screen.getByText('Experienced engineer with 10 years in full-stack development.')
      ).toBeInTheDocument()
    })

    it('should show placeholder "Your Name" when candidateInfo is not present', () => {
      const resume = createMockResume({ name: 'Fallback Resume Name' })
      // Ensure no candidateInfo
      delete (resume as Record<string, unknown>).candidateInfo
      render(<ClassicTemplate resume={resume} />)

      expect(screen.getByText('Your Name')).toBeInTheDocument()
      const nameEl = screen.getByText('Your Name').closest('h1')
      expect(nameEl).toHaveClass('classic-template__name--placeholder')
    })

    it('should handle partial candidateInfo with some fields null', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo({
          displayName: 'Partial User',
          email: 'partial@test.com',
          phone: null,
          location: null,
          links: [],
          summary: null,
        }),
      })
      render(<ClassicTemplate resume={resume} />)

      // Name and email should render
      expect(screen.getByText('Partial User')).toBeInTheDocument()
      expect(screen.getByText('partial@test.com')).toBeInTheDocument()

      // No location or summary
      expect(screen.queryByText('San Francisco, CA')).not.toBeInTheDocument()

      // No LinkedIn/GitHub links
      expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument()
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
    })

    it('should not render contact line when all contact fields are null', () => {
      const resume = createMockResume({
        candidateInfo: createMockCandidateInfo({
          email: null,
          phone: null,
          links: [],
        }),
      })
      render(<ClassicTemplate resume={resume} />)

      expect(screen.queryByTestId('template-contact')).not.toBeInTheDocument()
    })
  })
})
