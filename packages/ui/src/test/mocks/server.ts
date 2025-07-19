import { setupServer } from 'msw/node'
import { authHandlers } from './handlers/auth'
import { profileHandlers } from './handlers/profile'

export const server = setupServer(
  ...authHandlers,
  ...profileHandlers
) 