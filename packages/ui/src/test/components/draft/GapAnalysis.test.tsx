import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { GapAnalysis, type GapAnalysisProps } from '../../../components/draft/GapAnalysis'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const defaultProps: GapAnalysisProps = {
  jobTitle: 'Senior Software Engineer',
  company: 'Google',
  covered: [
    {
      requirement: {
        description: 'React experience',
        category: 'Frontend',
        importance: 'must_have',
      },
      matchedBullets: [
        { id: 'b-1', text: 'Built React dashboard', similarity: 0.92 },
        { id: 'b-2', text: 'Maintained React app', similarity: 0.85 },
      ],
    },
  ],
  gaps: [
    {
      requirement: {
        description: 'Kubernetes experience',
        category: 'DevOps',
        importance: 'must_have',
      },
    },
    {
      requirement: {
        description: 'GraphQL knowledge',
        category: 'Backend',
        importance: 'nice_to_have',
      },
    },
  ],
  totalRequirements: 3,
  coveredCount: 1,
  interviewContext: {
    mode: 'gaps',
    gaps: [
      { requirement: 'Kubernetes', category: 'DevOps', importance: 'must_have' as const },
    ],
    existingBulletSummary: 'Has frontend experience',
    jobTitle: 'Senior SWE',
  },
}

function renderGapAnalysis(props: Partial<GapAnalysisProps> = {}) {
  return render(
    <BrowserRouter>
      <GapAnalysis {...defaultProps} {...props} />
    </BrowserRouter>
  )
}

describe('GapAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the gap analysis container', () => {
    renderGapAnalysis()
    expect(screen.getByTestId('gap-analysis')).toBeInTheDocument()
  })

  it('displays job title and company in header', () => {
    renderGapAnalysis()
    expect(screen.getByText(/Senior Software Engineer at Google/)).toBeInTheDocument()
  })

  it('displays job title without company when company is null', () => {
    renderGapAnalysis({ company: null })
    expect(screen.getByText(/Senior Software Engineer/)).toBeInTheDocument()
    expect(screen.queryByText(/at Google/)).not.toBeInTheDocument()
  })

  it('displays coverage summary', () => {
    renderGapAnalysis()
    const summary = screen.getByTestId('gap-summary')
    expect(summary).toHaveTextContent('1/3 requirements covered')
    expect(summary).toHaveTextContent('2 gaps')
  })

  it('renders gap items', () => {
    renderGapAnalysis()
    const gapItems = screen.getAllByTestId('gap-item')
    expect(gapItems).toHaveLength(2)
    expect(screen.getByText('Kubernetes experience')).toBeInTheDocument()
    expect(screen.getByText('GraphQL knowledge')).toBeInTheDocument()
  })

  it('shows "Required" badge for must_have gaps', () => {
    renderGapAnalysis()
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('renders covered items', () => {
    renderGapAnalysis()
    const coveredItems = screen.getAllByTestId('covered-item')
    expect(coveredItems).toHaveLength(1)
    expect(screen.getByText('React experience')).toBeInTheDocument()
  })

  it('shows match count for covered requirements', () => {
    renderGapAnalysis()
    expect(screen.getByText('2 matches')).toBeInTheDocument()
  })

  it('shows "1 match" (singular) when only one bullet matches', () => {
    renderGapAnalysis({
      covered: [
        {
          requirement: {
            description: 'Node.js experience',
            category: 'Backend',
            importance: 'must_have',
          },
          matchedBullets: [
            { id: 'b-1', text: 'Built APIs with Node', similarity: 0.88 },
          ],
        },
      ],
    })
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })

  it('expands matched bullets on click', async () => {
    renderGapAnalysis()

    const coveredItem = screen.getByTestId('covered-item')
    await userEvent.click(coveredItem)

    expect(screen.getByText('Built React dashboard')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Maintained React app')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('collapses matched bullets on second click', async () => {
    renderGapAnalysis()

    const coveredItem = screen.getByTestId('covered-item')
    await userEvent.click(coveredItem) // expand
    expect(screen.getByText('Built React dashboard')).toBeInTheDocument()

    await userEvent.click(coveredItem) // collapse
    expect(screen.queryByText('Built React dashboard')).not.toBeInTheDocument()
  })

  it('shows interview button when gaps exist and context is provided', () => {
    renderGapAnalysis()
    expect(screen.getByTestId('interview-for-gaps')).toBeInTheDocument()
    expect(screen.getByText('Interview for Gaps')).toBeInTheDocument()
  })

  it('navigates to interview with context on button click', async () => {
    renderGapAnalysis()

    await userEvent.click(screen.getByTestId('interview-for-gaps'))

    expect(mockNavigate).toHaveBeenCalledWith('/interview', {
      state: { interviewContext: defaultProps.interviewContext },
    })
  })

  it('hides interview button when no gaps exist', () => {
    renderGapAnalysis({ gaps: [] })
    expect(screen.queryByTestId('interview-for-gaps')).not.toBeInTheDocument()
  })

  it('hides interview button when no interview context', () => {
    renderGapAnalysis({ interviewContext: null })
    expect(screen.queryByTestId('interview-for-gaps')).not.toBeInTheDocument()
  })

  it('does not render gaps section when no gaps', () => {
    renderGapAnalysis({ gaps: [] })
    expect(screen.queryByTestId('gap-item')).not.toBeInTheDocument()
  })

  it('does not render covered section when nothing is covered', () => {
    renderGapAnalysis({ covered: [] })
    expect(screen.queryByTestId('covered-item')).not.toBeInTheDocument()
  })

  it('displays gap category badges', () => {
    renderGapAnalysis()
    expect(screen.getByText('DevOps')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
  })
})
