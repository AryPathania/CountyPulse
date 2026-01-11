import { describe, it, expect } from 'vitest'
import {
  getTemplate,
  hasTemplate,
  listTemplates,
  DEFAULT_TEMPLATE_ID,
} from '../../templates/registry'

describe('Template Registry', () => {
  describe('getTemplate', () => {
    it('should return classic_v1 template', () => {
      const template = getTemplate('classic_v1')
      expect(template.metadata.id).toBe('classic_v1')
      expect(template.metadata.name).toBe('Classic')
      expect(template.Component).toBeDefined()
    })

    it('should fall back to classic_v1 for unknown template', () => {
      const template = getTemplate('unknown-template')
      expect(template.metadata.id).toBe('classic_v1')
    })

    it('should map legacy default to classic_v1', () => {
      const template = getTemplate('default')
      expect(template.metadata.id).toBe('classic_v1')
    })
  })

  describe('hasTemplate', () => {
    it('should return true for existing template', () => {
      expect(hasTemplate('classic_v1')).toBe(true)
    })

    it('should return false for unknown template', () => {
      expect(hasTemplate('unknown-template')).toBe(false)
    })

    it('should return true for legacy default mapping', () => {
      expect(hasTemplate('default')).toBe(true)
    })
  })

  describe('listTemplates', () => {
    it('should return array of template metadata', () => {
      const templates = listTemplates()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
    })

    it('should include classic_v1 template', () => {
      const templates = listTemplates()
      const classic = templates.find((t) => t.id === 'classic_v1')
      expect(classic).toBeDefined()
      expect(classic?.name).toBe('Classic')
      expect(classic?.description).toBeTruthy()
    })

    it('should only return metadata (no Component)', () => {
      const templates = listTemplates()
      templates.forEach((t) => {
        expect(t).toHaveProperty('id')
        expect(t).toHaveProperty('name')
        expect(t).toHaveProperty('description')
        expect(t).not.toHaveProperty('Component')
      })
    })
  })

  describe('DEFAULT_TEMPLATE_ID', () => {
    it('should be classic_v1', () => {
      expect(DEFAULT_TEMPLATE_ID).toBe('classic_v1')
    })

    it('should be a valid template', () => {
      expect(hasTemplate(DEFAULT_TEMPLATE_ID)).toBe(true)
    })
  })
})
