import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { db, users, creditLots } from '../db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { normalizeEmail } from './email'
import { findUserByEmail } from './users'
import { checkNamedRateLimit } from '../rate-limiter'
import { detectUniversity } from '../analytics/university-detector'
import { trackEvent } from '../analytics/tracker'

function oneYearFromNow() {
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  return expiresAt
}

// Auto-fix NEXTAUTH_URL if it's set to production URL but we're running locally
if (process.env.NEXTAUTH_URL && process.env.NODE_ENV === 'development') {
  try {
    const configuredUrl = new URL(process.env.NEXTAUTH_URL)
    const isProductionUrl = configuredUrl.hostname.includes('vercel.app') || configuredUrl.hostname.includes('netlify.app') || !configuredUrl.hostname.includes('localhost')
    
    if (isProductionUrl) {
      // Override with localhost for development
      process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL?.replace(configuredUrl.origin, 'http://localhost:3000') || 'http://localhost:3000'
      console.warn('[auth] NEXTAUTH_URL was set to production URL in development, auto-corrected to:', process.env.NEXTAUTH_URL)
    }
  } catch (e) {
    // Invalid URL, ignore
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const email = normalizeEmail(credentials?.email)
        if (!email || !credentials?.password) {
          return null
        }

        // Throttle password guessing per account and per client address
        const forwarded = String((req?.headers as any)?.['x-forwarded-for'] || '').split(',').pop()?.trim() || 'unknown'
        const [perAccount, perClient] = await Promise.all([
          checkNamedRateLimit('login:email', email, 10, 15 * 60 * 1000),
          checkNamedRateLimit('login:ip', forwarded, 30, 15 * 60 * 1000),
        ])
        if (!perAccount.allowed || !perClient.allowed) {
          return null
        }

        const user = await findUserByEmail(email)

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          creditsRemaining: user.creditsRemaining,
          isAdmin: user.isAdmin,
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Only trust the address if Google itself has verified it
        if ((profile as any)?.email_verified !== true || !user.email) {
          return false
        }
        const email = normalizeEmail(user.email)

        try {
          const existingUser = await findUserByEmail(email)

          if (!existingUser) {
            // Create new user with 1 free credit and auto-verify email (Google OAuth)
            const newUser = await db.transaction(async (tx) => {
              const [created] = await tx
                .insert(users)
                .values({
                  email,
                  creditsRemaining: 1,
                  emailVerified: true,
                  emailVerifiedAt: new Date(),
                })
                .returning()

              await tx.insert(creditLots).values({
                userId: created.id,
                source: 'signup',
                creditsTotal: 1,
                creditsRemaining: 1,
                expiresAt: oneYearFromNow(),
              })

              return created
            })

            user.id = newUser.id
          } else {
            // An account that was never email-verified may have been registered by someone
            // who does not own the address. Google has now proven ownership, so take over
            // the account and drop any password the squatter chose.
            if (!existingUser.emailVerified) {
              await db
                .update(users)
                .set({
                  emailVerified: true,
                  emailVerifiedAt: new Date(),
                  passwordHash: null,
                })
                .where(eq(users.id, existingUser.id))
            }
            user.id = existingUser.id
          }

          // Track university domain detection for Google sign-in
          if (user.email) {
            const university = detectUniversity(user.email)
            if (university) {
              // Track asynchronously to not block sign-in
              trackEvent('university_domain_detected', {
                domain: university.domain,
                universityName: university.name,
              }, {}, user.id).catch(console.error)
            }
          }
        } catch (error) {
          console.error('Google signIn callback error:', error)
          throw error
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id as string),
        })
        if (dbUser) {
          token.creditsRemaining = dbUser.creditsRemaining
          token.emailVerified = dbUser.emailVerified
          token.isAdmin = dbUser.isAdmin
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        // Refresh isAdmin (and credits) from DB so admin grants take effect without re-login
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
          columns: { isAdmin: true, creditsRemaining: true, emailVerified: true },
        })
        if (dbUser) {
          session.user.isAdmin = dbUser.isAdmin
          session.user.creditsRemaining = dbUser.creditsRemaining
          session.user.emailVerified = dbUser.emailVerified ?? false
        } else {
          session.user.creditsRemaining = (token.creditsRemaining as number) ?? 0
          session.user.emailVerified = (token.emailVerified as boolean) ?? false
          session.user.isAdmin = (token.isAdmin as boolean) ?? false
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
