# Skill: PDF + template registry (scalable formats)

## Goal
Support multiple resume formats later without changing business logic.

## Approach
- Store resume content as structured data (JSON):
  - sections
  - bullets (by ID)
  - ordering
- Templates are *pure renderers* from that JSON → HTML/React

## Registry
Create:
- `packages/ui/src/templates/registry.ts`
Exports:
- template metadata (id, name, description)
- render component

Adding a template later:
- new folder `templates/<id>/`
- add entry to registry
No DB changes required unless you want server-side template catalog.

## PDF generation
MVP option (simple): render HTML preview and use browser print/PDF.
Later: server-side rendering or @react-pdf/renderer.

