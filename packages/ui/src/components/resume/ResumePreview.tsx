import type { ResumeWithBullets } from '@odie/db'
import './ResumePreview.css'

interface ResumePreviewProps {
  resume: ResumeWithBullets
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  // Get bullet data by ID
  const getBulletById = (bulletId: string) => {
    return resume.bullets.find((b) => b.id === bulletId)
  }

  // Get position data by ID
  const getPositionById = (positionId: string) => {
    return resume.positions.find((p) => p.id === positionId)
  }

  return (
    <div className="resume-preview" data-testid="resume-preview">
      {/* Header */}
      <header className="resume-preview__header">
        <h1 className="resume-preview__name">{resume.name}</h1>
      </header>

      {/* Sections */}
      {resume.parsedContent.sections.map((section) => {
        // Skip empty sections
        if (section.items.length === 0) return null

        return (
          <section
            key={section.id}
            className="resume-preview__section"
            data-testid={`preview-section-${section.id}`}
          >
            <h2 className="resume-preview__section-title">{section.title}</h2>

            <div className="resume-preview__items">
              {section.items.map((item, index) => {
                if (item.type === 'position' && item.positionId) {
                  const position = getPositionById(item.positionId)
                  if (!position) return null

                  return (
                    <div
                      key={`pos-${item.positionId}-${index}`}
                      className="resume-preview__position"
                    >
                      <div className="resume-preview__position-header">
                        <span className="resume-preview__company">{position.company}</span>
                        <span className="resume-preview__dates">
                          {position.start_date} - {position.end_date ?? 'Present'}
                        </span>
                      </div>
                      <div className="resume-preview__title">{position.title}</div>
                    </div>
                  )
                }

                if (item.type === 'bullet' && item.bulletId) {
                  const bullet = getBulletById(item.bulletId)
                  if (!bullet) return null

                  return (
                    <div
                      key={`bullet-${item.bulletId}-${index}`}
                      className="resume-preview__bullet"
                      data-testid={`preview-bullet-${item.bulletId}`}
                    >
                      <span className="resume-preview__bullet-marker">•</span>
                      <span className="resume-preview__bullet-text">
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

      {/* Empty state */}
      {resume.parsedContent.sections.every((s) => s.items.length === 0) && (
        <div className="resume-preview__empty" data-testid="preview-empty">
          <p>Your resume is empty.</p>
          <p>Drag bullets into sections to build your resume.</p>
        </div>
      )}
    </div>
  )
}
