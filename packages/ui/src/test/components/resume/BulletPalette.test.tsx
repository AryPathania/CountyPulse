import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulletPalette } from '../../../components/resume/BulletPalette'
import type { ReactNode } from 'react'

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => children,
  useDraggable: (opts: { id: string }) => ({
    attributes: { 'data-draggable-id': opts.id },
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}))

const mockBullets = [
  {
    id: 'bullet-1',
    current_text: 'Led team of 5 engineers to deliver project on time',
    category: 'Leadership',
    position: { company: 'Tech Corp', title: 'Lead Engineer' },
  },
  {
    id: 'bullet-2',
    current_text: 'Reduced latency by 40% through caching strategy',
    category: 'Backend',
    position: { company: 'Tech Corp', title: 'Lead Engineer' },
  },
  {
    id: 'bullet-3',
    current_text: 'Built CI/CD pipeline reducing deploy time by 60%',
    category: 'DevOps',
    position: { company: 'StartupXYZ', title: 'Junior Dev' },
  },
  {
    id: 'bullet-4',
    current_text: 'Mentored 3 interns',
    category: null,
    position: null,
  },
]

describe('BulletPalette', () => {
  it('should render with available bullets count', () => {
    const usedIds = new Set(['bullet-1'])
    render(<BulletPalette allBullets={mockBullets} usedBulletIds={usedIds} />)

    expect(screen.getByTestId('bullet-palette')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-palette-count')).toHaveTextContent('3')
  })

  it('should not show used bullets', () => {
    const usedIds = new Set(['bullet-1', 'bullet-2'])
    render(<BulletPalette allBullets={mockBullets} usedBulletIds={usedIds} />)

    expect(screen.queryByTestId('palette-bullet-bullet-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('palette-bullet-bullet-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('palette-bullet-bullet-3')).toBeInTheDocument()
    expect(screen.getByTestId('palette-bullet-bullet-4')).toBeInTheDocument()
  })

  it('should group bullets by position', () => {
    const usedIds = new Set<string>()
    render(<BulletPalette allBullets={mockBullets} usedBulletIds={usedIds} />)

    expect(screen.getByText('Tech Corp - Lead Engineer')).toBeInTheDocument()
    expect(screen.getByText('StartupXYZ - Junior Dev')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('should show "All bullets are in use" when all are used', () => {
    const usedIds = new Set(['bullet-1', 'bullet-2', 'bullet-3', 'bullet-4'])
    render(<BulletPalette allBullets={mockBullets} usedBulletIds={usedIds} />)

    expect(screen.getByText('All bullets are in use')).toBeInTheDocument()
  })

  it('should truncate long bullet text at 80 chars', () => {
    const longBullet = [{
      id: 'long-bullet',
      current_text: 'A'.repeat(100),
      category: null,
      position: null,
    }]
    render(<BulletPalette allBullets={longBullet} usedBulletIds={new Set()} />)

    const bulletEl = screen.getByTestId('palette-bullet-long-bullet')
    expect(bulletEl).toHaveTextContent('A'.repeat(80) + '...')
  })

  it('should toggle palette body visibility', async () => {
    render(<BulletPalette allBullets={mockBullets} usedBulletIds={new Set()} />)

    expect(screen.getByTestId('bullet-palette-body')).toBeInTheDocument()

    // Click header to collapse
    await userEvent.click(screen.getByTestId('bullet-palette-header'))

    expect(screen.queryByTestId('bullet-palette-body')).not.toBeInTheDocument()

    // Click again to expand
    await userEvent.click(screen.getByTestId('bullet-palette-header'))

    expect(screen.getByTestId('bullet-palette-body')).toBeInTheDocument()
  })

  it('should show category badge when bullet has a category', () => {
    const usedIds = new Set<string>()
    render(<BulletPalette allBullets={mockBullets} usedBulletIds={usedIds} />)

    const bullet1 = screen.getByTestId('palette-bullet-bullet-1')
    expect(bullet1).toHaveTextContent('Leadership')
  })

  it('should render with empty bullets array', () => {
    render(<BulletPalette allBullets={[]} usedBulletIds={new Set()} />)

    expect(screen.getByTestId('bullet-palette')).toBeInTheDocument()
    expect(screen.getByTestId('bullet-palette-count')).toHaveTextContent('0')
    expect(screen.getByText('All bullets are in use')).toBeInTheDocument()
  })
})
