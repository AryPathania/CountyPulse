import { setupServer } from 'msw/node'
import { authHandlers } from './handlers/auth'
import { profileHandlers } from './handlers/profile'
import { interviewHandlers } from './handlers/interview'
import { jobDraftsHandlers } from './handlers/job-drafts'

export const server = setupServer(
  ...authHandlers,
  ...profileHandlers,
  ...interviewHandlers,
  ...jobDraftsHandlers
) 