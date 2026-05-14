import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  // @ts-ignore – PrismaAdapter type mismatch between next-auth v4 and @auth/prisma-adapter
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, `user` is the DB user — persist id and username in token
      if (user) {
        token.id = user.id;
        token.username = (user as any).username ?? null;
      }
      // On session update (e.g. after onboarding sets username), re-fetch from DB
      if (trigger === "update") {
        const dbUser = await db.user.findUnique({ where: { id: token.id as string } });
        if (dbUser) token.username = dbUser.username ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = (token.username as string | null) ?? null;
      }
      return session;
    },
  },
};
