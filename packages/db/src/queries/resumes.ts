import { supabase } from '../client'
import type { Database, Json } from '../types'

type Resume = Database['public']['Tables']['resumes']['Row']
type NewResume = Database['public']['Tables']['resumes']['Insert']
type UpdateResume = Database['public']['Tables']['resumes']['Update']

/**
 * Sub-section data stored inline in resume content JSON.
 * Represents a grouping header (e.g., position, degree, project).
 */
export interface SubSectionData {
  id: string
  title: string
  subtitle?: string
  startDate?: string
  endDate?: string
  location?: string
  positionId?: string
}

/**
 * Resume content JSON schema
 */
export interface ResumeContentItem {
  type: 'subsection' | 'bullet'
  subsectionId?: string
  bulletId?: string
}

export interface ResumeSection {
  id: string
  title: string
  items: ResumeContentItem[]
  subsections?: SubSectionData[]
}

export interface ResumeContent {
  sections: ResumeSection[]
}

/**
 * Create default resume content structure
 */
export function createDefaultResumeContent(): ResumeContent {
  return {
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        items: [],
        subsections: [],
      },
      {
        id: 'skills',
        title: 'Skills',
        items: [],
        subsections: [],
      },
      {
        id: 'education',
        title: 'Education',
        items: [],
        subsections: [],
      },
    ],
  }
}

/**
 * Parse resume content from JSON, with fallback to default
 */
export function parseResumeContent(content: unknown): ResumeContent {
  if (
    content &&
    typeof content === 'object' &&
    'sections' in content &&
    Array.isArray((content as ResumeContent).sections)
  ) {
    return content as ResumeContent
  }
  return createDefaultResumeContent()
}

/**
 * Get all resumes for a user
 */
export async function getResumes(userId: string): Promise<Resume[]> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Get a single resume by ID
 */
export async function getResume(resumeId: string): Promise<Resume | null> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

/**
 * Resume with parsed content and related bullets
 */
export interface ResumeWithBullets extends Resume {
  parsedContent: ResumeContent
  bullets: Array<{
    id: string
    current_text: string
    category: string | null
    position: {
      id: string
      company: string
      title: string
    } | null
  }>
  positions: Array<{
    id: string
    company: string
    title: string
    start_date: string | null
    end_date: string | null
    location: string | null
  }>
  candidateInfo?: {
    displayName: string
    email: string | null
    headline: string | null
    summary: string | null
    phone: string | null
    location: string | null
    linkedinUrl: string | null
    githubUrl: string | null
    websiteUrl: string | null
  }
}

/**
 * Normalize old resume content format (type: 'position') to new format (type: 'subsection').
 * Converts position items to subsection items and populates the subsections array.
 */
export function normalizeResumeContent(content: ResumeContent): ResumeContent {
  let needsNormalization = false
  for (const section of content.sections) {
    for (const item of section.items) {
      if ((item as { type: string }).type === 'position') {
        needsNormalization = true
        break
      }
    }
    if (needsNormalization) break
  }

  if (!needsNormalization) return content

  console.debug('[normalizeResumeContent] converting old position format to subsection')
  return {
    sections: content.sections.map((section) => {
      const subsections: SubSectionData[] = [...(section.subsections ?? [])]
      const newItems: ResumeContentItem[] = []

      for (const item of section.items) {
        const rawItem = item as { type: string; positionId?: string; bulletId?: string; subsectionId?: string }
        if (rawItem.type === 'position' && rawItem.positionId) {
          const subsectionId = `sub-${rawItem.positionId}`
          if (!subsections.find((s) => s.id === subsectionId)) {
            subsections.push({
              id: subsectionId,
              title: '',
              positionId: rawItem.positionId,
            })
          }
          newItems.push({ type: 'subsection', subsectionId })
        } else {
          newItems.push(item)
        }
      }

      return { ...section, items: newItems, subsections }
    }),
  }
}

/**
 * Get a resume with its associated bullets and positions
 */
export async function getResumeWithBullets(resumeId: string): Promise<ResumeWithBullets | null> {
  const resume = await getResume(resumeId)
  if (!resume) return null

  const parsedContent = normalizeResumeContent(parseResumeContent(resume.content))

  // Collect all bullet IDs and position IDs from content
  const bulletIds: string[] = []
  const positionIds: string[] = []

  for (const section of parsedContent.sections) {
    for (const item of section.items) {
      if (item.type === 'bullet' && item.bulletId) {
        bulletIds.push(item.bulletId)
      }
    }
    // Collect position IDs from sub-sections
    for (const sub of section.subsections ?? []) {
      if (sub.positionId) {
        positionIds.push(sub.positionId)
      }
    }
  }

  // Fetch bullets with positions
  let bullets: ResumeWithBullets['bullets'] = []
  if (bulletIds.length > 0) {
    const { data, error } = await supabase
      .from('bullets')
      .select(`
        id,
        current_text,
        category,
        positions (
          id,
          company,
          title
        )
      `)
      .in('id', bulletIds)

    if (error) throw error
    bullets = (data ?? []).map((b) => ({
      id: b.id,
      current_text: b.current_text,
      category: b.category,
      position: b.positions as ResumeWithBullets['bullets'][0]['position'],
    }))
  }

  // Fetch positions
  let positions: ResumeWithBullets['positions'] = []
  if (positionIds.length > 0) {
    const { data, error } = await supabase
      .from('positions')
      .select('id, company, title, start_date, end_date, location')
      .in('id', positionIds)

    if (error) throw error
    positions = data ?? []
  }

  // Fetch candidate info
  const [userProfileResult, candidateProfileResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', resume.user_id)
      .single(),
    supabase
      .from('candidate_profiles')
      .select('headline, summary, phone, location, linkedin_url, github_url, website_url')
      .eq('user_id', resume.user_id)
      .single(),
  ])

  // Get email from auth user session
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const candidateInfo = userProfileResult.data ? {
    displayName: userProfileResult.data.display_name,
    email: authUser?.email ?? null,
    headline: candidateProfileResult.data?.headline ?? null,
    summary: candidateProfileResult.data?.summary ?? null,
    phone: candidateProfileResult.data?.phone ?? null,
    location: candidateProfileResult.data?.location ?? null,
    linkedinUrl: candidateProfileResult.data?.linkedin_url ?? null,
    githubUrl: candidateProfileResult.data?.github_url ?? null,
    websiteUrl: candidateProfileResult.data?.website_url ?? null,
  } : undefined

  console.debug('[getResumeWithBullets] loaded candidate info for %s', candidateInfo?.displayName)

  return {
    ...resume,
    parsedContent,
    bullets,
    positions,
    candidateInfo,
  }
}

/**
 * Create a new resume
 */
export async function createResume(
  data: Omit<NewResume, 'content'> & { content?: ResumeContent }
): Promise<Resume> {
  const contentJson = (data.content ?? createDefaultResumeContent()) as unknown as Json

  const { data: resume, error } = await supabase
    .from('resumes')
    .insert({
      ...data,
      content: contentJson,
    })
    .select()
    .single()

  if (error) throw error
  return resume
}

/**
 * Update a resume
 */
export async function updateResume(
  resumeId: string,
  updates: Omit<UpdateResume, 'content'> & { content?: ResumeContent }
): Promise<Resume> {
  const { content, ...restUpdates } = updates
  const updateData: UpdateResume = {
    ...restUpdates,
    updated_at: new Date().toISOString(),
  }

  if (content) {
    updateData.content = content as unknown as Json
  }

  const { data, error } = await supabase
    .from('resumes')
    .update(updateData)
    .eq('id', resumeId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update resume content (sections and items ordering)
 */
export async function updateResumeContent(
  resumeId: string,
  content: ResumeContent
): Promise<Resume> {
  return updateResume(resumeId, { content })
}

/**
 * Delete a resume
 */
export async function deleteResume(resumeId: string): Promise<void> {
  const { error } = await supabase.from('resumes').delete().eq('id', resumeId)
  if (error) throw error
}

/**
 * Result of grouping bullets by position into sub-sections.
 */
export interface GroupedBulletsResult {
  items: ResumeContentItem[]
  subsections: SubSectionData[]
}

/**
 * Group bullets by position, creating sub-section headers.
 * Pure function (no DB calls) for testability.
 *
 * @param bulletIds - ordered list of bullet IDs to group
 * @param bulletRows - bullet ID to position_id mapping from DB
 * @param orderedPositionIds - position IDs sorted by start_date desc
 * @param positionDetails - position data for building sub-section headers
 * @returns items array and subsections array
 */
export function groupBulletsByPosition(
  bulletIds: string[],
  bulletRows: Array<{ id: string; position_id: string | null }>,
  orderedPositionIds: string[],
  positionDetails?: Array<{ id: string; company: string; title: string; start_date: string | null; end_date: string | null; location: string | null }>
): GroupedBulletsResult {
  const positionBullets = new Map<string, string[]>()
  const orphanBullets: string[] = []
  const bulletMap = new Map(bulletRows.map((b) => [b.id, b.position_id]))
  const positionMap = new Map((positionDetails ?? []).map((p) => [p.id, p]))

  for (const bulletId of bulletIds) {
    const posId = bulletMap.get(bulletId)
    if (posId) {
      if (!positionBullets.has(posId)) positionBullets.set(posId, [])
      positionBullets.get(posId)!.push(bulletId)
    } else {
      orphanBullets.push(bulletId)
    }
  }

  const items: ResumeContentItem[] = []
  const subsections: SubSectionData[] = []

  // Sub-section header + its bullets, ordered by start_date desc
  for (const posId of orderedPositionIds) {
    const bullets = positionBullets.get(posId)
    if (!bullets || bullets.length === 0) continue

    const subsectionId = `sub-${posId}`
    const pos = positionMap.get(posId)

    subsections.push({
      id: subsectionId,
      title: pos?.title ?? '',
      subtitle: pos?.company ?? '',
      startDate: pos?.start_date ?? undefined,
      endDate: pos?.end_date ?? undefined,
      location: pos?.location ?? undefined,
      positionId: posId,
    })

    items.push({ type: 'subsection', subsectionId })
    for (const bId of bullets) {
      items.push({ type: 'bullet', bulletId: bId })
    }
  }

  // Append orphan bullets at the end
  for (const bId of orphanBullets) {
    items.push({ type: 'bullet', bulletId: bId })
  }

  return { items, subsections }
}

/**
 * Create a resume from a job draft
 */
export async function createResumeFromDraft(
  userId: string,
  name: string,
  bulletIds: string[]
): Promise<Resume> {
  let experienceResult: GroupedBulletsResult = { items: [], subsections: [] }

  if (bulletIds.length > 0) {
    const { data: bulletRows, error: bulletError } = await supabase
      .from('bullets')
      .select('id, position_id')
      .in('id', bulletIds)

    if (bulletError) throw bulletError

    // Gather unique position IDs
    const positionIdSet = new Set<string>()
    for (const row of bulletRows ?? []) {
      if (row.position_id) positionIdSet.add(row.position_id)
    }
    const uniquePositionIds = Array.from(positionIdSet)

    // Fetch positions ordered by start_date desc (with details for sub-sections)
    let orderedPositionIds: string[] = []
    let positionDetails: Array<{ id: string; company: string; title: string; start_date: string | null; end_date: string | null; location: string | null }> = []
    if (uniquePositionIds.length > 0) {
      const { data: positionRows, error: posError } = await supabase
        .from('positions')
        .select('id, company, title, start_date, end_date, location')
        .in('id', uniquePositionIds)
        .order('start_date', { ascending: false })

      if (posError) throw posError
      orderedPositionIds = (positionRows ?? []).map((p) => p.id)
      positionDetails = positionRows ?? []
    }

    experienceResult = groupBulletsByPosition(bulletIds, bulletRows ?? [], orderedPositionIds, positionDetails)

    console.debug(
      '[createResumeFromDraft] grouped %d bullets into %d sub-sections',
      bulletIds.length,
      experienceResult.subsections.length
    )
  }

  const content: ResumeContent = {
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        items: experienceResult.items,
        subsections: experienceResult.subsections,
      },
      {
        id: 'skills',
        title: 'Skills',
        items: [],
        subsections: [],
      },
      {
        id: 'education',
        title: 'Education',
        items: [],
        subsections: [],
      },
    ],
  }

  return createResume({
    user_id: userId,
    name,
    content,
  })
}
