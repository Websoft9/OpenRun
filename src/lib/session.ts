import { createMiddleware } from 'hono/factory'
import { auth, type AuthSession } from './auth.js'

declare module 'hono' {
  interface ContextVariableMap {
    session: AuthSession | null
  }
}

export const sessionMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  c.set('session', session)
  await next()
})
