import CredentialsProvider from 'next-auth/providers/credentials'
import NextAuth from 'next-auth'
import { type NextAuthConfig } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/lib/auth.config'

export const authOptions: NextAuthConfig = {
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== 'string' || typeof credentials.password !== 'string') return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        })

        if (!user || !user.activo || !(await bcrypt.compare(credentials.password, user.password))) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
}

export const { auth } = NextAuth(authOptions)
