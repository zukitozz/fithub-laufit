import { type NextAuthConfig } from 'next-auth'
import type { UserRole } from '@/types/user'

// Config edge-safe: sin bcrypt ni Prisma, para poder usarse en middleware.
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: UserRole }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        session.user.role = (token.role as UserRole) ?? 'ADMIN'
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
