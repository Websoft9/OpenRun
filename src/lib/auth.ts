import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { openDatabase } from '../db/database.js'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, expected] = stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !expected) {
    return false
  }

  const actual = scryptSync(password, salt, 64)
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

const database = openDatabase()
const authSecret = process.env.BETTER_AUTH_SECRET

if (!authSecret && process.env.NODE_ENV === 'production') {
  throw new Error('BETTER_AUTH_SECRET is required in production')
}

export const auth = betterAuth({
  appName: 'OpenWise',
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 9000}`,
  secret: authSecret ?? 'openrun-dev-secret-change-in-production',
  database,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    password: {
      hash: async (password) => hashPassword(password),
      verify: async ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  user: {
    changeEmail: {
      enabled: false,
    },
  },
  plugins: [admin()],
})

export type AuthSession = typeof auth.$Infer.Session

export async function ensureAuthMigrations(): Promise<void> {
  const { getMigrations } = await import('better-auth/db/migration')
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}
