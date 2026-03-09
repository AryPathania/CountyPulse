import {
  supabase,
  createUploadedResume,
  getUploadedResumeByHash,
  uploadResumeFile,
  createPositionWithBullets,
} from '@odie/db'
import type { Json } from '@odie/db'
import type { InterviewContext, ResumeParseOutput } from '@odie/shared'
import { ResumeParseOutputSchema } from '@odie/shared'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MiB

export interface ResumeUploadResult {
  context: InterviewContext
  parsedData: ResumeParseOutput
  uploadedResumeId: string
  stats: {
    strongBullets: number
    fixableBullets: number
    weakBullets: number
    positions: number
  }
}

/**
 * Compute SHA-256 hash of a file using Web Crypto API
 */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Extract text from PDF using client-side approach.
 * Falls back to server-side extraction if client extraction returns <50 chars.
 */
async function extractPdfText(file: File): Promise<string> {
  // Try client-side extraction first (dynamic import -- module may not exist yet)
  try {
    const mod = await import('../lib/pdf-extract')
    const text = await mod.extractTextFromPdf(file)
    if (text.length >= 50) {
      return text
    }
  } catch {
  }

  // Server-side fallback
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('extract-pdf', {
    body: await file.arrayBuffer(),
  })

  if (response.error) {
    throw new Error(response.error.message || 'Server PDF extraction failed')
  }

  return response.data?.text || ''
}

/**
 * Full resume upload flow:
 * 1. Validate file size
 * 2. Compute hash for dedup
 * 3. Check for duplicate
 * 4. Extract text
 * 5. Upload to storage
 * 6. Parse with LLM
 * 7. Create DB records
 * 8. Build InterviewContext
 */
export async function uploadAndParseResume(
  userId: string,
  file: File
): Promise<ResumeUploadResult> {
  // 1. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File must be under 10MB')
  }

  // 2. Compute hash
  const fileHash = await computeFileHash(file)

  // 3. Check for duplicate
  const existing = await getUploadedResumeByHash(userId, fileHash)
  if (existing?.parsed_data) {
    const parsedData = ResumeParseOutputSchema.parse(existing.parsed_data)
    return buildResult(existing.id, parsedData)
  }

  // 4. Extract text
  const extractedText = await extractPdfText(file)
  if (extractedText.length < 10) {
    throw new Error('Could not extract text from PDF. Please try a different file.')
  }

  // 5. Upload to storage
  const storagePath = `${userId}/${fileHash}.pdf`
  await uploadResumeFile(userId, file, storagePath)

  // 6. Parse with LLM
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const parseResponse = await supabase.functions.invoke('parse-resume', {
    body: { text: extractedText },
  })

  if (parseResponse.error) {
    throw new Error(parseResponse.error.message || 'Resume parsing failed')
  }

  const parsed = ResumeParseOutputSchema.safeParse(parseResponse.data)
  if (!parsed.success) {
    throw new Error('Invalid response format from resume parser')
  }

  const parsedData = parsed.data

  // 7. Create uploaded_resumes record
  const uploadedResume = await createUploadedResume({
    user_id: userId,
    file_name: file.name,
    file_hash: fileHash,
    storage_path: storagePath,
    extracted_text: extractedText,
    parsed_data: parsedData as unknown as Json,
  })

  // 8. Create positions + strong/fixable bullets in DB
  for (const pos of parsedData.positions) {
    const strongAndFixable = pos.bullets.filter(
      b => b.classification === 'strong' || b.classification === 'fixable'
    )

    if (strongAndFixable.length > 0) {
      const bulletText = (b: typeof strongAndFixable[number]) =>
        b.classification === 'fixable' && b.fixedText ? b.fixedText : b.originalText

      await createPositionWithBullets(
        {
          user_id: userId,
          company: pos.company,
          title: pos.title,
          location: pos.location ?? null,
          start_date: pos.startDate ?? null,
          end_date: pos.endDate ?? null,
        },
        strongAndFixable.map(b => ({
          original_text: b.originalText,
          current_text: bulletText(b),
          category: b.category ?? undefined,
          hard_skills: b.hardSkills,
          soft_skills: b.softSkills,
        }))
      )
    }
  }

  return buildResult(uploadedResume.id, parsedData)
}

/**
 * Build the result with InterviewContext from parsed data
 */
function buildResult(
  uploadedResumeId: string,
  parsedData: ResumeParseOutput
): ResumeUploadResult {
  const allBullets = parsedData.positions.flatMap(p => p.bullets)
  const strongBullets = allBullets.filter(b => b.classification === 'strong')
  const fixableBullets = allBullets.filter(b => b.classification === 'fixable')
  const weakBullets = allBullets.filter(b => b.classification === 'weak')

  // Map strong + fixable bullets into the InterviewBullet shape (BulletSchema)
  const usableBullets = [...strongBullets, ...fixableBullets]

  const context: InterviewContext = {
    mode: 'resume',
    strongBullets: usableBullets.map(b => ({
      text: b.classification === 'fixable' && b.fixedText ? b.fixedText : b.originalText,
      category: b.category,
      hardSkills: b.hardSkills,
      softSkills: b.softSkills,
    })),
    weakBullets: weakBullets
      .filter(b => b.suggestedQuestion)
      .map(b => ({
        originalText: b.originalText,
        suggestedQuestion: b.suggestedQuestion!,
      })),
    positions: parsedData.positions.map(p => ({
      company: p.company,
      title: p.title,
      location: p.location,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
    skills: parsedData.skills,
    education: parsedData.education.map(e => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      graduationDate: e.graduationDate,
    })),
  }

  return {
    context,
    parsedData,
    uploadedResumeId,
    stats: {
      strongBullets: strongBullets.length,
      fixableBullets: fixableBullets.length,
      weakBullets: weakBullets.length,
      positions: parsedData.positions.length,
    },
  }
}
