import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SortableSection } from '../../../components/resume/SortableSection'
import type { ResumeSection } from '@odie/db'
import type { ReactNode } from 'react'

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  verticalListSortingStrategy: 'vertical',
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

const mockBullets = [
  {
    id: 'bullet-1',
    current_text: 'Led team of 5 engineers',
    category: 'Leadership',
    position: { id: 'pos-1', company: 'Tech Corp', title: 'Lead Engineer' },
  },
  {
    id: 'bullet-2',
    current_text: 'Reduced latency by 40%',
    category: 'Backend',
    position: { id: 'pos-1', company: 'Tech Corp', title: 'Lead Engineer' },
  },
  {
    id: 'bullet-3',
    current_text: 'Built CI/CD pipeline',
    category: 'DevOps',
    position: null,
  },
]

describe('SortableSection', () => {
  const defaultProps = {
    bullets: mockBullets,
    onEditBullet: vi.fn(),
  }

  describe('sub-section header rendering', () => {
    it('should render a sub-section with title, subtitle, and dates', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [
          { type: 'subsection', subsectionId: 'sub-pos-1' },
          { type: 'bullet', bulletId: 'bullet-1' },
        ],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      const header = screen.getByTestId('subsection-sub-pos-1')
      expect(header).toBeInTheDocument()
      expect(header).toHaveTextContent('Lead Engineer')
      expect(header).toHaveTextContent('Tech Corp')
      expect(header).toHaveTextContent('San Francisco, CA')
    })

    it('should format start and end dates correctly', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'subsection', subsectionId: 'sub-pos-1' }],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      const header = screen.getByTestId('subsection-sub-pos-1')
      // Jun 2022 - Jan 2024
      expect(header).toHaveTextContent('Jun 2022')
      expect(header).toHaveTextContent('Jan 2024')
    })

    it('should show "Present" when endDate is undefined', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'subsection', subsectionId: 'sub-pos-current' }],
        subsections: [
          {
            id: 'sub-pos-current',
            title: 'Dev',
            subtitle: 'Current Co',
            startDate: '2023-01-01',
          },
        ],
      }

      render(
        <SortableSection
          section={section}
          bullets={[]}
          onEditBullet={vi.fn()}
        />
      )

      expect(screen.getByText(/Present/)).toBeInTheDocument()
    })

    it('should not render location when sub-section has no location', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'subsection', subsectionId: 'sub-pos-2' }],
        subsections: [
          {
            id: 'sub-pos-2',
            title: 'Software Engineer',
            subtitle: 'StartupXYZ',
            startDate: '2020-03-01',
            endDate: '2022-05-01',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      const header = screen.getByTestId('subsection-sub-pos-2')
      expect(header).toBeInTheDocument()
      expect(header).toHaveTextContent('StartupXYZ')
      // No location element should be rendered within the header
      const locationEl = header.querySelector('.sortable-subsection__location')
      expect(locationEl).toBeNull()
    })

    it('should not render sub-section when sub-section data is missing', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'subsection', subsectionId: 'non-existent' }],
        subsections: [],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      expect(screen.queryByTestId('subsection-non-existent')).not.toBeInTheDocument()
    })
  })

  describe('sub-sections are draggable', () => {
    it('should include sub-section items in sortable item IDs', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [
          { type: 'subsection', subsectionId: 'sub-pos-1' },
          { type: 'bullet', bulletId: 'bullet-1' },
          { type: 'bullet', bulletId: 'bullet-2' },
        ],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      // Sub-section should have a drag handle
      const subsectionEl = screen.getByTestId('subsection-sub-pos-1')
      expect(subsectionEl.querySelector('.sortable-subsection__handle')).not.toBeNull()
    })

    it('should render sub-section as a sortable item with sortable attributes', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'subsection', subsectionId: 'sub-pos-1' }],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      const header = screen.getByTestId('subsection-sub-pos-1')
      expect(header.className).toContain('sortable-subsection')
      // Sub-sections should have sortable attributes via useSortable
      expect(header.querySelector('[data-sortable-id]')).not.toBeNull()
    })
  })

  describe('mixed sub-section and bullet rendering', () => {
    it('should render interleaved sub-section headers and bullets', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [
          { type: 'subsection', subsectionId: 'sub-pos-1' },
          { type: 'bullet', bulletId: 'bullet-1' },
          { type: 'bullet', bulletId: 'bullet-2' },
          { type: 'subsection', subsectionId: 'sub-pos-2' },
          { type: 'bullet', bulletId: 'bullet-3' },
        ],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
            location: 'San Francisco, CA',
          },
          {
            id: 'sub-pos-2',
            title: 'Software Engineer',
            subtitle: 'StartupXYZ',
            startDate: '2020-03-01',
            endDate: '2022-05-01',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      // Both sub-section headers should render
      expect(screen.getByTestId('subsection-sub-pos-1')).toBeInTheDocument()
      expect(screen.getByTestId('subsection-sub-pos-2')).toBeInTheDocument()

      // All bullets should render
      expect(screen.getByTestId('bullet-bullet-1')).toBeInTheDocument()
      expect(screen.getByTestId('bullet-bullet-2')).toBeInTheDocument()
      expect(screen.getByTestId('bullet-bullet-3')).toBeInTheDocument()

      // Verify sub-section header content
      const sub1 = screen.getByTestId('subsection-sub-pos-1')
      expect(sub1).toHaveTextContent('Lead Engineer')
      const sub2 = screen.getByTestId('subsection-sub-pos-2')
      expect(sub2).toHaveTextContent('Software Engineer')
    })

    it('should render bullets correctly without any sub-section items', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [
          { type: 'bullet', bulletId: 'bullet-1' },
          { type: 'bullet', bulletId: 'bullet-2' },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      expect(screen.getByTestId('bullet-bullet-1')).toBeInTheDocument()
      expect(screen.getByTestId('bullet-bullet-2')).toBeInTheDocument()
      expect(screen.queryByTestId(/^subsection-/)).not.toBeInTheDocument()
    })

    it('should render section title', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'subsection', subsectionId: 'sub-pos-1' }],
        subsections: [
          {
            id: 'sub-pos-1',
            title: 'Lead Engineer',
            subtitle: 'Tech Corp',
            startDate: '2022-06-01',
            endDate: '2024-01-15',
          },
        ],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      expect(screen.getByText('Experience')).toBeInTheDocument()
    })

    it('should show empty message when section has no items', () => {
      const section: ResumeSection = {
        id: 'skills',
        title: 'Skills',
        items: [],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      expect(screen.getByText('Drag bullets here to add them to this section')).toBeInTheDocument()
    })

    it('should render bullet text content', () => {
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'bullet', bulletId: 'bullet-1' }],
      }

      render(<SortableSection section={section} {...defaultProps} />)

      expect(screen.getByText('Led team of 5 engineers')).toBeInTheDocument()
    })

    it('should call onEditBullet when edit button is clicked', async () => {
      const onEditBullet = vi.fn()
      const section: ResumeSection = {
        id: 'experience',
        title: 'Experience',
        items: [{ type: 'bullet', bulletId: 'bullet-1' }],
      }

      render(
        <SortableSection
          section={section}
          bullets={mockBullets}
          onEditBullet={onEditBullet}
        />
      )

      const editBtn = screen.getByTestId('edit-bullet-bullet-1')
      editBtn.click()

      expect(onEditBullet).toHaveBeenCalledWith('bullet-1')
    })
  })
})
