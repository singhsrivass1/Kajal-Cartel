import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';

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
    
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as typeof session.user & { id: string }).id = token.id as string;
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