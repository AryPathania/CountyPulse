import type { TemplateProps } from '../types'
import './ClassicTemplate.css'

/**
 * Classic resume template with traditional styling.
 * Uses Georgia serif font with centered header and section dividers.
 */
export function ClassicTemplate({ resume }: TemplateProps) {
  // Get bullet data by ID
  const getBulletById = (bulletId: string) => {
    return resume.bullets.find((b) => b.id === bulletId)
  }

  // Get position data by ID
  const getPositionById = (positionId: string) => {
    return resume.positions.find((p) => p.id === positionId)
  }

  const hasContent = resume.parsedContent.sections.some((s) => s.items.length > 0)

  if (!hasContent) {
    return (
      <div className="classic-template" data-testid="template-classic">
        <header className="classic-template__header">
          <h1 className="classic-template__name">{resume.name}</h1>
        </header>
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
      <header className="classic-template__header">
        <h1 className="classic-template__name">{resume.name}</h1>
      </header>

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
                if (item.type === 'position' && item.positionId) {
                  const position = getPositionById(item.positionId)
                  if (!position) return null

                  return (
                    <div
                      key={`pos-${item.positionId}-${index}`}
                      className="classic-template__position"
                    >
                      <div className="classic-template__position-header">
                        <span className="classic-template__company">{position.company}</span>
                        <span className="classic-template__dates">
                          {position.start_date} - {position.end_date ?? 'Present'}
                        </span>
                      </div>
                      <div className="classic-template__title">{position.title}</div>
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
