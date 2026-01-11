# Spec: Resume Builder (DnD + preview + shared bullet editing)

Status: Draft  
Owner: UI Agent + Contract Agent  
Date: 2026-01-10

## Goal
Let the user:
- arrange sections
- drag/drop bullets into sections
- reorder bullets
- edit a bullet inline using the shared BulletEditor
- toggle Preview mode quickly

## Data model
The resume builder edits `resumes.content` JSON:
```json
{
  "sections": [
    {
      "id": "experience",
      "title": "Experience",
      "items": [
        { "type": "position", "positionId": "..." },
        { "type": "bullet", "bulletId": "..." }
      ]
    }
  ]
}
```

## UI
Route: `/resumes/:id/edit`
Split view:
- left: builder (DnD)
- right: preview (sticky)
Toggle:
- full preview mode

DnD library:
- recommend `@dnd-kit` (lightweight, composable)

## DRY rule
- Bullet editing uses the same BulletEditor component as `/bullets`.

## Acceptance criteria
- DnD works and persists ordering
- Preview reflects ordering
- Editing bullet updates DB and reflects everywhere

## Test plan
- Unit:
  - JSON schema for resume content
- E2E:
  - drag bullet A above bullet B, reload page, order persists
  - edit bullet text, preview updates

