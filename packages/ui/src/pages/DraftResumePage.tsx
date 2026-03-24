import { useEffect, useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUploadedResumes, getProfileEntries, toSubSectionData, updateJobDraftTriageDecisions } from '@odie/db'
import { CATEGORY_LABELS } from '@odie/shared'
import type { ProfileEntryCategory, TriageDecision } from '@odie/shared'
import type { ResumeParseOutput } from '@odie/shared'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { useJobDraftWithBullets, useRunGapAnalysis } from '../queries/job-drafts'
import { useCreateResumeFromDraft } from '../queries/resumes'
import { bulletKeys, useBullets } from '../queries/bullets'
import { buildGapDataFromStored, buildInterviewContextFromGaps, hashRequirementDescription, STAGE_MESSAGES, type GapAnalysisStage, type GapAnalysisServiceResult, type UserSkills } from '../services/jd-processing'
import { GapAnalysis } from '../components/draft/GapAnalysis'
import './DraftResumePage.css'

/**
 * Draft Resume page displays matched bullets for an existing job draft.
 * The draft is always created before navigation (in HomePage).
 * This page only fetches and displays an existing draft by URL param ID.
 */
export function DraftResumePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Load existing draft via TanStack Query
  const { data: draft, isLoading, error: loadError } = useJobDraftWithBullets(
    id && id !== 'draft' ? id : undefined
  )

  // Fetch most recent uploaded resume to get education/skills parsed data
  const { data: uploadedResumes } = useQuery({
    queryKey: ['uploadedResumes', user?.id],
    queryFn: () => getUploadedResumes(user!.id),
    enabled: !!user?.id,
  })

  // Fetch profile entries (education, certifications, awards, etc.)
  const { data: profileEntries } = useQuery({
    queryKey: ['profileEntries', user?.id],
    queryFn: () => getProfileEntries(user!.id),
    enabled: !!user?.id,
  })

  // Fetch user bullets for skill aggregation
  const { data: userBullets } = useBullets(user?.id)

  // Aggregate skills from uploaded resume parsed data + bullet skills
  const aggregatedSkills: UserSkills | undefined = useMemo(() => {
    const hard = new Set<string>()
    const soft = new Set<string>()

    // From uploaded resume parsed data
    const latestUpload = uploadedResumes?.[0]
    const parsedData = latestUpload?.parsed_data as ResumeParseOutput | null | undefined
    if (parsedData?.skills) {
      parsedData.skills.hard.forEach(s => hard.add(s))
      parsedData.skills.soft.forEach(s => soft.add(s))
    }

    // From bullet hard_skills / soft_skills
    if (userBullets) {
      for (const bullet of userBullets) {
        bullet.hard_skills?.forEach(s => hard.add(s))
        bullet.soft_skills?.forEach(s => soft.add(s))
      }
    }

    if (hard.size === 0 && soft.size === 0) return undefined
    return { hard: [...hard], soft: [...soft] }
  }, [uploadedResumes, userBullets])

  // Gap analysis mutation
  const gapAnalysis = useRunGapAnalysis()
  const createResume = useCreateResumeFromDraft()

  // Derive gap data from stored column (if available)
  const storedGapData = draft?.gap_analysis
    ? buildGapDataFromStored(draft.id, draft.gap_analysis as Parameters<typeof buildGapDataFromStored>[1])
    : null

  // Staleness detection: compare analyzedAt with bullets cache timestamp
  const bulletsState = queryClient.getQueryState(bulletKeys.lists())
  const isStale = !!(
    storedGapData?.analyzedAt &&
    bulletsState?.dataUpdatedAt &&
    bulletsState.dataUpdatedAt > new Date(storedGapData.analyzedAt).getTime()
  )

  const needsAnalysis = !!draft && (!storedGapData || isStale)
  const isAnalyzing = gapAnalysis.isPending
  const gapData: GapAnalysisServiceResult | null =
    storedGapData && !isStale
      ? storedGapData
      : gapAnalysis.data ?? null

  // Analysis progress stage
  const [analysisStage, setAnalysisStage] = useState<GapAnalysisStage | null>(null)

  // Triage decisions state — initialized from stored data
  const [triageDecisions, setTriageDecisions] = useState<Record<string, TriageDecision>>({})

  // Sync triage decisions from stored/fresh gap data
  useEffect(() => {
    if (gapData?.triageDecisions && Object.keys(gapData.triageDecisions).length > 0) {
      setTriageDecisions(gapData.triageDecisions)
    }
  }, [gapData?.triageDecisions])

  // Count items that need triage (gaps + partials without a decision)
  const untriagedCount = useMemo(() => {
    if (!gapData) return 0
    let count = 0
    for (const g of gapData.gaps) {
      const key = hashRequirementDescription(g.requirement.description)
      if (!triageDecisions[key]) count++
    }
    for (const p of gapData.partiallyCovered) {
      const key = hashRequirementDescription(p.requirement.description)
      if (!triageDecisions[key]) count++
    }
    return count
  }, [gapData, triageDecisions])

  const handleTriageDecision = useCallback((requirementDescription: string, decision: TriageDecision) => {
    const key = hashRequirementDescription(requirementDescription)
    setTriageDecisions(prev => {
      const next = { ...prev, [key]: decision }

      // Compute ignored requirements for training data
      const ignoredRequirements: string[] = []
      if (gapData) {
        for (const g of [...gapData.gaps, ...gapData.partiallyCovered]) {
          const k = hashRequirementDescription(g.requirement.description)
          if (next[k] === 'ignored') {
            ignoredRequirements.push(g.requirement.description)
          }
        }
      }

      // Persist to DB (fire-and-forget)
      if (draft?.id) {
        updateJobDraftTriageDecisions(draft.id, next, ignoredRequirements).catch(console.error)
      }

      return next
    })
  }, [gapData, draft?.id])

  // Recompute interview context when triage decisions change
  const interviewContext = useMemo(() => {
    if (!gapData) return null
    return buildInterviewContextFromGaps(
      gapData.gaps,
      gapData.covered,
      gapData.jobTitle,
      gapData.company,
      triageDecisions,
      gapData.partiallyCovered
    )
  }, [gapData, triageDecisions])

  // Auto-trigger gap analysis when needed
  useEffect(() => {
    if (needsAnalysis && !isAnalyzing && !gapAnalysis.data && draft?.jd_text && user?.id) {
      setAnalysisStage(null)
      gapAnalysis.mutate({ userId: user.id, jdText: draft.jd_text, draftId: draft.id, skills: aggregatedSkills, onProgress: setAnalysisStage })
    }
  }, [needsAnalysis, isAnalyzing, gapAnalysis, draft?.id, draft?.jd_text, user?.id, aggregatedSkills])

  // Group profile entries by category for resume creation
  const groupedProfileEntries = useMemo(() => {
    if (!profileEntries || profileEntries.length === 0) return undefined
    const grouped = profileEntries.reduce(
      (acc, entry) => {
        if (!acc[entry.category]) acc[entry.category] = []
        acc[entry.category].push(toSubSectionData(entry))
        return acc
      },
      {} as Record<string, ReturnType<typeof toSubSectionData>[]>
    )
    return Object.entries(grouped).map(([category, entries]) => ({
      category: CATEGORY_LABELS[category as ProfileEntryCategory] ?? category,
      entries,
    }))
  }, [profileEntries])

  const handleCreateResume = useCallback(() => {
    if (!draft || !user?.id) return
    const bulletIds = draft.bullets.map(b => b.id)
    const name = gapData?.jobTitle || draft.job_title || 'Untitled Resume'

    // Extract education/skills from the most recent uploaded resume's parsed data
    const latestUpload = uploadedResumes?.[0]
    const parsedData = latestUpload?.parsed_data as ResumeParseOutput | null | undefined

    createResume.mutate(
      {
        userId: user.id,
        name,
        bulletIds,
        options: {
          ...(parsedData ? {
            education: parsedData.education,
            skills: parsedData.skills,
          } : {}),
          profileEntries: groupedProfileEntries,
        },
      },
      { onSuccess: (resume) => navigate(`/resumes/${resume.id}/edit`) }
    )
  }, [draft, user?.id, gapData?.jobTitle, createResume, navigate, uploadedResumes, groupedProfileEntries])

  const error = loadError instanceof Error ? loadError.message : loadError ? String(loadError) : null

  if (isLoading) {
    return (
      <div className="draft-page" data-testid="draft-page">
        <Navigation />
        <main className="draft-page__main">
          <div className="draft-page__loading" data-testid="draft-loading">
            <div className="spinner" />
            <p>Finding your best bullets...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="draft-page" data-testid="draft-page">
        <Navigation />
        <main className="draft-page__main">
          <div className="draft-page__error" data-testid="draft-error">
            <p>{error}</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Back to Home
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="draft-page" data-testid="draft-page">
      <Navigation />

      <main className="draft-page__main">
        <header className="draft-page__header">
          <div>
            <h1 className="draft-page__title">
              {gapData?.jobTitle || (draft?.job_title && !/^https?:\/\//.test(draft.job_title) ? draft.job_title : 'Resume Draft')}
            </h1>
            {(gapData?.company || draft?.company) && (
              <p className="draft-page__company">{gapData?.company || draft?.company}</p>
            )}
          </div>
          <button
            onClick={handleCreateResume}
            className="btn-primary"
            data-testid="create-resume-btn"
            disabled={createResume.isPending || isAnalyzing || untriagedCount > 0}
          >
            {createResume.isPending ? 'Creating...' : isAnalyzing ? 'Analyzing...' : untriagedCount > 0 ? `Create Resume (${untriagedCount} items need triage)` : 'Create Resume'}
          </button>
        </header>

        <div className="draft-page__content">
          {isAnalyzing || needsAnalysis ? (
            <div className="draft-page__analyzing" data-testid="gap-loading">
              <div className="spinner" />
              <p>{STAGE_MESSAGES[analysisStage ?? 'parsing']}</p>
            </div>
          ) : (
            <>
              <section className="draft-page__bullets">
                <h2 className="draft-page__section-title">
                  Matched Bullets ({draft?.bullets.length ?? 0})
                </h2>
                <p className="draft-page__section-desc">
                  These bullets from your library best match the job description
                </p>

                {draft?.bullets && draft.bullets.length > 0 ? (
                  <ul className="draft-page__bullet-list" data-testid="bullet-list">
                    {draft.bullets.map((bullet) => (
                      <li
                        key={bullet.id}
                        className="draft-page__bullet-item"
                        data-testid={`bullet-${bullet.id}`}
                      >
                        <div className="bullet-content">
                          <p className="bullet-text">{bullet.current_text}</p>
                          <div className="bullet-meta">
                            {bullet.category && (
                              <span className="bullet-category">{bullet.category}</span>
                            )}
                            {bullet.position && (
                              <span className="bullet-position">
                                {bullet.position.company} - {bullet.position.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="draft-page__empty" data-testid="no-bullets">
                    <p>No matching bullets found.</p>
                    <button
                      onClick={() => navigate('/interview')}
                      className="btn-secondary"
                    >
                      Start Interview to Add Bullets
                    </button>
                  </div>
                )}
              </section>

              {gapData && (
                <GapAnalysis
                  jobTitle={gapData.jobTitle}
                  company={gapData.company}
                  covered={gapData.covered}
                  partiallyCovered={gapData.partiallyCovered}
                  gaps={gapData.gaps}
                  totalRequirements={gapData.totalRequirements}
                  coveredCount={gapData.coveredCount}
                  interviewContext={interviewContext}
                  triageDecisions={triageDecisions}
                  onTriageDecision={handleTriageDecision}
                  untriagedCount={untriagedCount}
                  fitSummary={gapData.fitSummary}
                  refineFailed={gapData.refineFailed}
                />
              )}
            </>
          )}

          {gapAnalysis.isError && (
            <div className="draft-page__error" data-testid="gap-error">
              <p>Gap analysis failed: {gapAnalysis.error instanceof Error ? gapAnalysis.error.message : 'Unknown error'}</p>
              <button
                onClick={() => {
                  if (draft?.jd_text && user?.id) {
                    setAnalysisStage(null)
                    gapAnalysis.mutate({ userId: user.id, jdText: draft.jd_text, draftId: draft.id, skills: aggregatedSkills, onProgress: setAnalysisStage })
                  }
                }}
                className="btn-secondary"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {draft?.jd_text && (
            <aside className="draft-page__jd">
              <h2 className="draft-page__section-title">Job Description</h2>
              <div className="draft-page__jd-text" data-testid="jd-text">
                {draft.jd_text}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}
