import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import bcrypt from 'bcryptjs';
import clientPromise from '@/lib/mongodb';
import { dbConnect } from '@/lib/db/connect';
import User from '@/lib/db/models/User';
import { isPasswordAuthEnabled } from '@/lib/email/delivery';
import { verifyOAuthSignIn } from '@/lib/auth/googleProfile';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!isPasswordAuthEnabled()) return null;

        await dbConnect();
        const email = credentials.email.toLowerCase().trim();
        const user = await User.findOne({ email }).select('+passwordHash');
        if (!user || !user.passwordHash || !user.credentialsVerifiedAt) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      },
    }),
  ],

  
  adapter: MongoDBAdapter(clientPromise),

  
  secret: process.env.NEXTAUTH_SECRET,

  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, 
  },

  pages: {
    signIn: '/auth',
    error: '/auth',
  },

  callbacks: {
    signIn: verifyOAuthSignIn,

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.authProvider = account.provider;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token) {
        const sessionUser = session.user as typeof session.user & { id: string; authProvider?: string };
        sessionUser.id = token.id as string;
        sessionUser.authProvider = typeof token.authProvider === 'string' ? token.authProvider : undefined;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      console.info(`[NextAuth] New user created: ${user.email}`);
    },
  },
};