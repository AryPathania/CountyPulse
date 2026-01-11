import type { ResumeWithBullets } from '@odie/db'

export interface TemplateMetadata {
  id: string
  name: string
  description: string
}

export interface TemplateProps {
  resume: ResumeWithBullets
}

export interface Template {
  metadata: TemplateMetadata
  Component: React.ComponentType<TemplateProps>
}
