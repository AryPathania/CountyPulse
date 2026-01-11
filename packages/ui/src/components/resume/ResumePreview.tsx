import type { ResumeWithBullets } from '@odie/db'
import { getTemplate, DEFAULT_TEMPLATE_ID } from '../../templates'
import './ResumePreview.css'

interface ResumePreviewProps {
  resume: ResumeWithBullets
  templateId?: string
}

/**
 * Resume preview container that renders the selected template.
 * Delegates rendering to the template component from the registry.
 */
export function ResumePreview({ resume, templateId }: ResumePreviewProps) {
  const template = getTemplate(templateId ?? resume.template_id ?? DEFAULT_TEMPLATE_ID)
  const TemplateComponent = template.Component

  return (
    <div className="resume-preview" data-testid="resume-preview">
      <TemplateComponent resume={resume} />
    </div>
  )
}
