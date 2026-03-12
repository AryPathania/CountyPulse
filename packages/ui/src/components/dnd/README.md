# Drag-and-Drop Block Registry

This directory tracks all draggable/droppable block types in the resume builder. New block types should be registered here.

## Current Blocks

| Block | Component | Draggable | Drop Target | Location |
|-------|-----------|-----------|-------------|----------|
| Section | inline in `ResumeBuilderPage` | Yes | Between sections | Left column |
| Subsection | `SortableSubSection` | Yes | Within section | Within section card |
| Bullet | `SortableItem` / `BulletCard` | Yes | Within/across sections | Within section card |
| Personal Info | `PersonalInfoPanel` (in `ResumeBuilderPage`) | No (pinned top) | — | Top of left column |

## Adding a New Block Type

1. Decide if it's draggable (needs a drag handle) or pinned.
2. Implement the component in `packages/ui/src/components/`.
3. Register it in this table.
4. Wire drag/drop via `@dnd-kit/sortable` (see existing Section/Subsection/Bullet patterns in `ResumeBuilderPage.tsx`).
5. Add unit + E2E tests (see `test/pages/ResumeBuilderPage.test.tsx` and `e2e/` for patterns).

## Future: DnD Primitives Package

Once there are 6+ block types, consider extracting shared drag handle, drop zone, and sensor config into `packages/dnd/`. Each block would implement a `DndBlock` interface with standard props. A `dnd-component` skill/agent would scaffold new types from a template.

## DnD Library

Uses `@dnd-kit/core` + `@dnd-kit/sortable`. See `ResumeBuilderPage.tsx` for the `DndContext`, `SortableContext`, and sensor configuration.
