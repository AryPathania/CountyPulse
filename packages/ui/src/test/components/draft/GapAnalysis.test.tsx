import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { GapAnalysis, type GapAnalysisProps } from '../../../components/draft/GapAnalysis'
import { hashRequirementDescription } from '../../../services/jd-processing'

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
  partiallyCovered: [],
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
  triageDecisions: {},
  onTriageDecision: vi.fn(),
  untriagedCount: 2,
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
    expect(summary).toHaveTextContent('2 gap')
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
    const header = coveredItem.querySelector('.gap-analysis__item-header')!
    await userEvent.click(header)

    expect(screen.getByText('Built React dashboard')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Maintained React app')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('collapses matched bullets on second click', async () => {
    renderGapAnalysis()

    const coveredItem = screen.getByTestId('covered-item')
    const header = coveredItem.querySelector('.gap-analysis__item-header')!
    await userEvent.click(header) // expand
    expect(screen.getByText('Built React dashboard')).toBeInTheDocument()

    await userEvent.click(header) // collapse
    expect(screen.queryByText('Built React dashboard')).not.toBeInTheDocument()
  })

  it('shows interview button when gaps exist and context is provided', () => {
    renderGapAnalysis()
    expect(screen.getByTestId('interview-for-gaps')).toBeInTheDocument()
    expect(screen.getByTestId('interview-for-gaps')).toHaveTextContent(/Begin Interview for Gaps/)
  })

  it('disables interview button when untriaged items exist', () => {
    renderGapAnalysis({ untriagedCount: 2 })
    expect(screen.getByTestId('interview-for-gaps')).toBeDisabled()
  })

  it('enables interview button when all items triaged', async () => {
    renderGapAnalysis({ untriagedCount: 0 })
    const btn = screen.getByTestId('interview-for-gaps')
    expect(btn).not.toBeDisabled()

    await userEvent.click(btn)
    expect(mockNavigate).toHaveBeenCalledWith('/interview', {
      state: { interviewContext: defaultProps.interviewContext },
    })
  })

  it('hides interview button when no interview context', () => {
    renderGapAnalysis({ interviewContext: null })
    expect(screen.queryByTestId('interview-for-gaps')).not.toBeInTheDocument()
  })

  it('does not render gaps section when no gaps', () => {
    renderGapAnalysis({ gaps: [], untriagedCount: 0 })
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

  describe('partially covered items', () => {
    const partialProps: Partial<GapAnalysisProps> = {
      partiallyCovered: [
        {
          requirement: {
            description: 'AWS cloud experience',
            category: 'Cloud',
            importance: 'must_have',
          },
          reasoning: 'Candidate has some S3 usage but lacks broader AWS experience',
          evidenceBullets: [
            { id: 'b-3', text: 'Used S3 for file storage', similarity: 0.55 },
          ],
        },
      ],
      untriagedCount: 3,
    }

    it('renders partially covered items with "Partial" badge', () => {
      renderGapAnalysis(partialProps)
      const partialItems = screen.getAllByTestId('partial-item')
      expect(partialItems).toHaveLength(1)
      expect(screen.getByText('Partial')).toBeInTheDocument()
      expect(screen.getByText('AWS cloud experience')).toBeInTheDocument()
    })

    it('shows reasoning when partial item is expanded', async () => {
      renderGapAnalysis(partialProps)
      const partialItem = screen.getByTestId('partial-item')
      const header = partialItem.querySelector('.gap-analysis__item-header')!
      await userEvent.click(header)
      expect(screen.getByText('Candidate has some S3 usage but lacks broader AWS experience')).toBeInTheDocument()
    })

    it('shows evidence bullets when partial item is expanded', async () => {
      renderGapAnalysis(partialProps)
      const partialItem = screen.getByTestId('partial-item')
      const header = partialItem.querySelector('.gap-analysis__item-header')!
      await userEvent.click(header)
      expect(screen.getByText('Used S3 for file storage')).toBeInTheDocument()
      expect(screen.getByText('55%')).toBeInTheDocument()
    })

    it('includes partial count in summary when partials exist', () => {
      renderGapAnalysis(partialProps)
      const summary = screen.getByTestId('gap-summary')
      expect(summary).toHaveTextContent('1 partial')
    })
  })

  describe('triage buttons', () => {
    it('shows triage buttons on gap items', () => {
      renderGapAnalysis()
      const triageGroups = screen.getAllByTestId('triage-buttons')
      expect(triageGroups.length).toBeGreaterThanOrEqual(2)
    })

    it('calls onTriageDecision with "ignored" when "Not a Gap" clicked on gap item', async () => {
      const onTriageDecision = vi.fn()
      renderGapAnalysis({ onTriageDecision })
      const ignoreButtons = screen.getAllByTestId('triage-ignore')
      await userEvent.click(ignoreButtons[0])
      expect(onTriageDecision).toHaveBeenCalledWith('Kubernetes experience', 'ignored')
    })

    it('calls onTriageDecision with "interview" when Add to Interview clicked', async () => {
      const onTriageDecision = vi.fn()
      renderGapAnalysis({ onTriageDecision })
      const interviewButtons = screen.getAllByTestId('triage-interview')
      await userEvent.click(interviewButtons[0])
      expect(onTriageDecision).toHaveBeenCalledWith('Kubernetes experience', 'interview')
    })

    it('shows "Not a Gap" label on gap items and "Already Covered" on partial items', () => {
      renderGapAnalysis({
        partiallyCovered: [
          {
            requirement: { description: 'Docker', category: 'DevOps', importance: 'nice_to_have' },
            reasoning: 'Some exposure',
            evidenceBullets: [],
          },
        ],
        untriagedCount: 3,
      })
      const ignoreButtons = screen.getAllByTestId('triage-ignore')
      // First button is from partial item ("Already Covered"), rest from gaps ("Not a Gap")
      expect(ignoreButtons[0]).toHaveTextContent('Already Covered')
      expect(ignoreButtons[1]).toHaveTextContent('Not a Gap')
    })

    it('does not show Include button (removed from UX)', () => {
      renderGapAnalysis()
      expect(screen.queryByTestId('triage-include')).not.toBeInTheDocument()
    })

    it('shows triage buttons on partial items', () => {
      renderGapAnalysis({
        partiallyCovered: [
          {
            requirement: { description: 'Docker', category: 'DevOps', importance: 'nice_to_have' },
            reasoning: 'Some exposure',
            evidenceBullets: [],
          },
        ],
        untriagedCount: 3,
      })
      const partialItem = screen.getByTestId('partial-item')
      expect(partialItem.querySelector('[data-testid="triage-buttons"]')).toBeInTheDocument()
    })
  })

  describe('triaged items section', () => {
    it('shows triaged items with correct badge', () => {
      const k8sHash = hashRequirementDescription('Kubernetes experience')
      const gqlHash = hashRequirementDescription('GraphQL knowledge')

      renderGapAnalysis({
        triageDecisions: {
          [k8sHash]: 'interview',
          [gqlHash]: 'ignored',
        },
        untriagedCount: 0,
      })

      const triagedItems = screen.getAllByTestId('triaged-item')
      expect(triagedItems).toHaveLength(2)
      expect(screen.getByText('Interview')).toBeInTheDocument()
      expect(screen.getByText('Ignored')).toBeInTheDocument()
    })

    it('shows "Already Covered" badge for included triage decision (backward compat)', () => {
      const k8sHash = hashRequirementDescription('Kubernetes experience')

      renderGapAnalysis({
        triageDecisions: { [k8sHash]: 'included' },
        gaps: [defaultProps.gaps[0]],
        untriagedCount: 1,
      })

      expect(screen.getByText('Already Covered')).toBeInTheDocument()
    })
  })

  describe('bulk interview button', () => {
    it('appears when 8+ untriaged items exist', () => {
      const manyGaps = Array.from({ length: 8 }, (_, i) => ({
        requirement: {
          description: `Requirement ${i}`,
          category: 'General',
          importance: 'must_have' as const,
        },
      }))

      renderGapAnalysis({
        gaps: manyGaps,
        untriagedCount: 8,
      })

      expect(screen.getByTestId('bulk-interview-btn')).toBeInTheDocument()
    })

    it('does not appear when fewer than 8 untriaged items', () => {
      renderGapAnalysis({ untriagedCount: 2 })
      expect(screen.queryByTestId('bulk-interview-btn')).not.toBeInTheDocument()
    })

    it('calls onTriageDecision for all untriaged gaps and partials', async () => {
      const onTriageDecision = vi.fn()
      const manyGaps = Array.from({ length: 6 }, (_, i) => ({
        requirement: {
          description: `Gap ${i}`,
          category: 'General',
          importance: 'must_have' as const,
        },
      }))
      const partials = Array.from({ length: 3 }, (_, i) => ({
        requirement: {
          description: `Partial ${i}`,
          category: 'General',
          importance: 'nice_to_have' as const,
        },
        reasoning: 'Some coverage',
        evidenceBullets: [],
      }))

      renderGapAnalysis({
        gaps: manyGaps,
        partiallyCovered: partials,
        onTriageDecision,
        untriagedCount: 9,
      })

      const bulkBtn = screen.getByTestId('bulk-interview-btn')
      await userEvent.click(bulkBtn)

      // Should call for each gap + each partial
      expect(onTriageDecision).toHaveBeenCalledTimes(9)
      // All calls should be 'interview'
      for (const call of onTriageDecision.mock.calls) {
        expect(call[1]).toBe('interview')
      }
    })
  })

  describe('fitSummary and refineFailed', () => {
    it('renders fitSummary when provided', () => {
      renderGapAnalysis({ fitSummary: 'Strong candidate with relevant frontend experience.' })
      expect(screen.getByTestId('fit-summary')).toHaveTextContent('Strong candidate with relevant frontend experience.')
    })

    it('does not render fitSummary when not provided', () => {
      renderGapAnalysis({ fitSummary: undefined })
      expect(screen.queryByTestId('fit-summary')).not.toBeInTheDocument()
    })

    it('renders refineFailed notice when true', () => {
      renderGapAnalysis({ refineFailed: true })
      expect(screen.getByTestId('refine-failed-notice')).toHaveTextContent('Enhanced analysis unavailable')
    })

    it('does not render refineFailed notice when false or undefined', () => {
      renderGapAnalysis({ refineFailed: false })
      expect(screen.queryByTestId('refine-failed-notice')).not.toBeInTheDocument()
    })
  })

  describe('interview button with triage', () => {
    it('shows triage count in label when untriaged items exist', () => {
      renderGapAnalysis({ untriagedCount: 3 })
      expect(screen.getByTestId('interview-for-gaps')).toHaveTextContent('3 items need triage')
    })

    it('does not show triage count when all triaged', () => {
      renderGapAnalysis({ untriagedCount: 0 })
      const btn = screen.getByTestId('interview-for-gaps')
      expect(btn).toHaveTextContent('Begin Interview for Gaps')
      expect(btn).not.toHaveTextContent('items need triage')
    })

    it('is disabled when untriaged items exist', () => {
      renderGapAnalysis({ untriagedCount: 5 })
      expect(screen.getByTestId('interview-for-gaps')).toBeDisabled()
    })
  })
})
