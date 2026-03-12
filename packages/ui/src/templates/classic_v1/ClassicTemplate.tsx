import { formatDisplayDate } from '@odie/shared'
import type { TemplateProps } from '../types'
import './ClassicTemplate.css'

/**
 * Render the resume header with candidate contact info.
 */
function ResumeHeader({ resume }: TemplateProps) {
  const contactParts: Array<{ label: string; href?: string }> = []
  if (resume.candidateInfo) {
    const info = resume.candidateInfo
    if (info.email) contactParts.push({ label: info.email })
    for (const link of info.links ?? []) {
      contactParts.push({ label: link.label, href: link.url })
    }
    if (info.phone) contactParts.push({ label: info.phone })
  }

  return (
    <header className="classic-template__header">
      <h1 className="classic-template__name">
        {resume.candidateInfo?.displayName || resume.name}
      </h1>
      {resume.candidateInfo && (
        <>
          {contactParts.length > 0 && (
            <div className="classic-template__contact" data-testid="template-contact">
              {contactParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="classic-template__separator"> · </span>}
                  {part.href ? (
                    <a href={part.href} className="classic-template__link">{part.label}</a>
                  ) : (
                    <span>{part.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {resume.candidateInfo.location && (
            <div className="classic-template__location">{resume.candidateInfo.location}</div>
          )}
          {resume.candidateInfo.summary && (
            <div className="classic-template__summary">{resume.candidateInfo.summary}</div>
          )}
        </>
      )}
    </header>
  )
}

/**
 * Classic resume template with traditional styling.
 * Uses Georgia serif font with centered header and section dividers.
 */
export function ClassicTemplate({ resume }: TemplateProps) {
  // Get bullet data by ID
  const getBulletById = (bulletId: string) => {
    return resume.bullets.find((b) => b.id === bulletId)
  }

  // Get sub-section data by ID
  const getSubSectionById = (subsectionId: string, sectionSubsections: typeof resume.parsedContent.sections[0]['subsections']) => {
    return (sectionSubsections ?? []).find((s) => s.id === subsectionId)
  }

  const hasContent = resume.parsedContent.sections.some((s) => s.items.length > 0)

  if (!hasContent) {
    return (
      <div className="classic-template" data-testid="template-classic">
        <ResumeHeader resume={resume} />
        <div className="classic-template__empty" data-testid="template-empty">
          <p>Your resume is empty.</p>
          <p>Drag bullets into sections to build your resume.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="classic-template" data-testid="template-classic">
      {/* Header */}
      <ResumeHeader resume={resume} />

      {/* Sections */}
      {resume.parsedContent.sections.map((section) => {
        // Skip empty sections
        if (section.items.length === 0) return null

        return (
          <section
            key={section.id}
            className="classic-template__section"
            data-testid={`template-section-${section.id}`}
          >
            <h2 className="classic-template__section-title">{section.title}</h2>

            <div className="classic-template__items">
              {section.items.map((item, index) => {
                if (item.type === 'subsection' && item.subsectionId) {
                  const subsection = getSubSectionById(item.subsectionId, section.subsections)
                  if (!subsection) return null

                  return (
                    <div
                      key={`sub-${item.subsectionId}-${index}`}
                      className="classic-template__position"
                      data-testid={`template-subsection-${item.subsectionId}`}
                    >
                      <div className="classic-template__position-header">
                        <span className="classic-template__company">{subsection.subtitle}</span>
                        {(subsection.startDate || subsection.endDate) && (
                          <span className="classic-template__dates">
                            {formatDisplayDate(subsection.startDate)} - {formatDisplayDate(subsection.endDate)}
                          </span>
                        )}
                      </div>
                      <div className="classic-template__title">{subsection.title}</div>
                    </div>
                  )
                }

                if (item.type === 'bullet' && item.bulletId) {
                  const bullet = getBulletById(item.bulletId)
                  if (!bullet) return null

                  return (
                    <div
                      key={`bullet-${item.bulletId}-${index}`}
                      className="classic-template__bullet"
                      data-testid={`template-bullet-${item.bulletId}`}
                    >
                      <span className="classic-template__bullet-marker">•</span>
                      <span className="classic-template__bullet-text">
                        {bullet.current_text}
                      </span>
                    </div>
                  )
                }

                return null
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
