# Security + RLS checklist (Supabase)

For every user-owned table:
- add `user_id uuid not null`
- enable RLS
- add policies:
  - SELECT: `user_id = auth.uid()`
  - INSERT: `user_id = auth.uid()`
  - UPDATE: `user_id = auth.uid()`
  - DELETE: `user_id = auth.uid()`

For join tables with two user-owned FKs:
- ensure both are owned by auth.uid OR enforce via FK chain

Never:
- expose service role key to the browser
- run privileged DB writes from UI

