import NextAuth from "next-auth";
import Github from "next-auth/providers/github";

export const { auth, handlers, singIn, singOut } = NextAuth({
  providers: [
    Github({
      clientId: process.env.AUTH_GITHUB_ID as string,
      clientSecret: process.env.AUTH_GITHUB_SECRET as string,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      return session;
    },
  },
});
