import type { Template, TemplateMetadata } from './types'
import { classicV1Template } from './classic_v1'

/**
 * Template registry - central store for all resume templates.
 */
const templates = new Map<string, Template>([
  ['classic_v1', classicV1Template],
])

/**
 * Legacy template ID mappings.
 * Maps old IDs to current template IDs.
 */
const legacyMappings: Record<string, string> = {
  default: 'classic_v1',
}

/**
 * Resolve a template ID, handling legacy mappings.
 */
function resolveTemplateId(id: string): string {
  return legacyMappings[id] ?? id
}

/**
 * Get a template by ID.
 * Falls back to classic_v1 if not found.
 */
export function getTemplate(id: string): Template {
  const resolvedId = resolveTemplateId(id)
  return templates.get(resolvedId) ?? classicV1Template
}

/**
 * Check if a template exists.
 */
export function hasTemplate(id: string): boolean {
  const resolvedId = resolveTemplateId(id)
  return templates.has(resolvedId)
}

/**
 * List all available templates.
 * Excludes legacy IDs.
 */
export function listTemplates(): TemplateMetadata[] {
  return Array.from(templates.values()).map((t) => t.metadata)
}

/**
 * Get the default template ID.
 */
export const DEFAULT_TEMPLATE_ID = 'classic_v1'
