import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import type { AdapterUser } from 'next-auth/adapters';
import { clientPromise } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';
import { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials, req) {
        if (req.headers?.accept?.includes('application/json')) {
          req.headers.redirect = 'manual';
        }
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const client = await clientPromise;
          const db = client.db(process.env.QUIZ_DB);
          const user = await db.collection('users').findOne({
            email: credentials.email.toLowerCase().trim(),
          });

          if (!user || !user.password) {
            return null;
          }

          const isPasswordValid = await compare(
            credentials.password,
            user.password,
          );
          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            emailVerified: null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: user.role || 'user', // Default to 'user' if role not set
          } as AdapterUser;
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        const client = await clientPromise;
        const db = client.db(process.env.QUIZ_DB);
        const user = await db.collection('users').findOne({
          _id: new ObjectId(token.sub),
        });

        if (user) {
          session.user.name = user.name;
          session.user.email = user.email;
          session.user.avatar = user.avatar;
          session.user.id = user._id.toString();
          session.user.role = user.role || 'user'; // Default to 'user' if role not set
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'user'; // Default to 'user' if role not set
      }
      return token;
    },
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
