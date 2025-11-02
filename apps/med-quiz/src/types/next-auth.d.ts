import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      avatar?: string | null;
      createdAt: Date;
      role: "admin" | "editor" | "user";
    };
  }

  interface User {
    id: string;
    role: "admin" | "editor" | "user";
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    createdAt: Date;
  }
}
