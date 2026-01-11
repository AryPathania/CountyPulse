import type { Template } from '../types'
import { ClassicTemplate } from './ClassicTemplate'

export const classicV1Template: Template = {
  metadata: {
    id: 'classic_v1',
    name: 'Classic',
    description: 'Traditional resume layout with serif fonts and centered header',
  },
  Component: ClassicTemplate,
}

export { ClassicTemplate }
