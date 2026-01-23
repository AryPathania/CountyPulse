/**
 * Test fixtures for consistent mock data across all tests.
 * Use these factory functions instead of inline mock data to ensure consistency.
 */
import type { BulletWithPosition, ResumeWithBullets, Position } from '@odie/db'
import type { ResumeContent } from '@odie/db'

// Standard test user ID - use this across all tests
export const TEST_USER_ID = 'test-user-123'

// Standard test timestamps
export const TEST_CREATED_AT = '2024-01-01T00:00:00Z'
export const TEST_UPDATED_AT = '2024-01-01T00:00:00Z'

/**
 * Create a mock bullet with position context.
 * All fields are consistent and can be overridden.
 */
export function createMockBullet(
  overrides: Partial<BulletWithPosition> = {}
): BulletWithPosition {
  return {
    id: 'bullet-1',
    user_id: TEST_USER_ID,
    position_id: 'position-1',
    original_text: 'Led team of 5 engineers',
    current_text: 'Led team of 5 engineers to deliver project on time',
    category: 'Leadership',
    hard_skills: ['Python', 'SQL'],
    soft_skills: ['Leadership', 'Communication'],
    was_edited: false,
    is_draft: false,
    embedding: null,
    created_at: TEST_CREATED_AT,
    updated_at: TEST_UPDATED_AT,
    position: {
      company: 'Acme Corp',
      title: 'Software Engineer',
    },
    ...overrides,
  }
}

/**
 * Create multiple mock bullets with unique IDs.
 * Useful for testing lists and filtering.
 */
export function createMockBullets(count: number): BulletWithPosition[] {
  const companies = ['Acme Corp', 'TechCo', 'StartupXYZ']
  const titles = ['Software Engineer', 'Tech Lead', 'Senior Developer']
  const categories = ['Leadership', 'Technical', 'Backend', 'Frontend']

  return Array.from({ length: count }, (_, i) => ({
    ...createMockBullet(),
    id: `bullet-${i + 1}`,
    position_id: `position-${(i % 3) + 1}`,
    original_text: `Original text ${i + 1}`,
    current_text: `Current text ${i + 1}`,
    category: categories[i % categories.length],
    was_edited: i % 2 === 0,
    position: {
      company: companies[i % companies.length],
      title: titles[i % titles.length],
    },
  }))
}

/**
 * Create a mock position.
 */
export function createMockPosition(
  overrides: Partial<Position> = {}
): Position {
  return {
    id: 'position-1',
    user_id: TEST_USER_ID,
    company: 'Acme Corp',
    title: 'Software Engineer',
    location: null,
    start_date: '2022-01-01',
    end_date: null,
    created_at: TEST_CREATED_AT,
    updated_at: TEST_UPDATED_AT,
    ...overrides,
  }
}

/**
 * Create a mock resume with bullets and positions.
 */
export function createMockResume(
  overrides: Partial<ResumeWithBullets> = {}
): ResumeWithBullets {
  return {
    id: 'resume-1',
    user_id: TEST_USER_ID,
    name: 'Test Resume',
    template_id: 'classic_v1',
    content: { sections: [] },
    created_at: TEST_CREATED_AT,
    updated_at: TEST_UPDATED_AT,
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
        position: { id: 'position-1', company: 'Acme Corp', title: 'Software Engineer' },
      },
    ],
    positions: [],
    ...overrides,
  }
}

/**
 * Create mock resume content structure.
 */
export function createMockResumeContent(
  overrides: Partial<ResumeContent> = {}
): ResumeContent {
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
    ...overrides,
  }
}

/**
 * Create a mock user object (for auth context).
 */
export function createMockUser(
  overrides: Partial<{ id: string; email: string }> = {}
) {
  return {
    id: TEST_USER_ID,
    email: 'test@example.com',
    ...overrides,
  }
}

/**
 * Create a mock interview message.
 */
export function createMockMessage(
  role: 'user' | 'assistant',
  content: string,
  overrides: Partial<{ id: string; timestamp: string }> = {}
) {
  return {
    id: `msg-${Date.now()}`,
    role,
    content,
    timestamp: TEST_CREATED_AT,
    ...overrides,
  }
}

/**
 * Create mock extracted data from interview.
 */
export function createMockExtractedData(
  overrides: Partial<{
    positions: Array<{
      position: {
        company: string
        title: string
        startDate?: string
        endDate?: string
        location?: string
      }
      bullets: Array<{
        text: string
        category?: string
        hardSkills?: string[]
        softSkills?: string[]
      }>
    }>
  }> = {}
) {
  return {
    positions: [
      {
        position: {
          company: 'Acme Corp',
          title: 'Software Engineer',
          startDate: '2022-01',
          endDate: '2024-01',
          location: 'San Francisco',
        },
        bullets: [
          {
            text: 'Led team of 5 engineers to deliver project on time',
            category: 'Leadership',
            hardSkills: ['Python', 'SQL'],
            softSkills: ['Leadership', 'Communication'],
          },
        ],
      },
    ],
    ...overrides,
  }
}
