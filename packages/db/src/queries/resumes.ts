import { supabase } from '../client'
import type { Database, Json } from '../types'

type Resume = Database['public']['Tables']['resumes']['Row']
type NewResume = Database['public']['Tables']['resumes']['Insert']
type UpdateResume = Database['public']['Tables']['resumes']['Update']

/**
 * Resume content JSON schema
 */
export interface ResumeContentItem {
  type: 'position' | 'bullet'
  positionId?: string
  bulletId?: string
}

export interface ResumeSection {
  id: string
  title: string
  items: ResumeContentItem[]
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
      },
      {
        id: 'skills',
        title: 'Skills',
        items: [],
      },
      {
        id: 'education',
        title: 'Education',
        items: [],
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
  }>
}

/**
 * Get a resume with its associated bullets and positions
 */
export async function getResumeWithBullets(resumeId: string): Promise<ResumeWithBullets | null> {
  const resume = await getResume(resumeId)
  if (!resume) return null

  const parsedContent = parseResumeContent(resume.content)

  // Collect all bullet IDs and position IDs from content
  const bulletIds: string[] = []
  const positionIds: string[] = []

  for (const section of parsedContent.sections) {
    for (const item of section.items) {
      if (item.type === 'bullet' && item.bulletId) {
        bulletIds.push(item.bulletId)
      }
      if (item.type === 'position' && item.positionId) {
        positionIds.push(item.positionId)
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
      .select('id, company, title, start_date, end_date')
      .in('id', positionIds)

    if (error) throw error
    positions = data ?? []
  }

  return {
    ...resume,
    parsedContent,
    bullets,
    positions,
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
 * Create a resume from a job draft
 */
export async function createResumeFromDraft(
  userId: string,
  name: string,
  bulletIds: string[]
): Promise<Resume> {
  const content: ResumeContent = {
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        items: bulletIds.map((bulletId) => ({
          type: 'bullet' as const,
          bulletId,
        })),
      },
      {
        id: 'skills',
        title: 'Skills',
        items: [],
      },
      {
        id: 'education',
        title: 'Education',
        items: [],
      },
    ],
  }

  return createResume({
    user_id: userId,
    name,
    content,
  })
}
