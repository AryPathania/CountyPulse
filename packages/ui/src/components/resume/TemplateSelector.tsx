import { listTemplates } from '../../templates'
import './TemplateSelector.css'

interface TemplateSelectorProps {
  selectedId: string
  onSelect: (templateId: string) => void
  disabled?: boolean
}

/**
 * Template selector dropdown for choosing resume templates.
 */
export function TemplateSelector({ selectedId, onSelect, disabled }: TemplateSelectorProps) {
  const templates = listTemplates()

  return (
    <div className="template-selector" data-testid="template-selector">
      <label className="template-selector__label" htmlFor="template-select">
        Template:
      </label>
      <select
        id="template-select"
        className="template-selector__select"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        data-testid="template-select"
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
    </div>
  )
}
