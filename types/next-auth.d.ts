import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      creditsRemaining?: number
      emailVerified?: boolean
      isAdmin?: boolean
    }
  }

  interface User {
    id: string
    email?: string | null
    creditsRemaining?: number
    emailVerified?: boolean
    isAdmin?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    creditsRemaining?: number
    emailVerified?: boolean
    isAdmin?: boolean
  }
}

