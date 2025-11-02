import NextAuth from "next-auth";
// import CredentialsProvider from "next-auth/providers/credentials";
// import { compare } from "bcryptjs";
// import prisma from "@/lib/prisma";
// import { PrismaAdapter } from "@auth/prisma-adapter";
import { authOptions } from "@/lib/auth/authOptions";

/**
 * NextAuth.js API route handler for authentication
 * @module auth/[...nextauth]/route
 * @description
 * - Configures NextAuth.js with authentication options
 * - Handles all authentication routes (/api/auth/*)
 * - Supports both GET and POST methods for authentication flows
 *
 * @see {@link https://next-auth.js.org/configuration/initialization#route-handlers-advanced} NextAuth.js route handlers
 */
const handler = NextAuth(authOptions);

/**
 * Exported GET handler for authentication requests
 * @type {import("next-auth").AuthHandler}
 * @description Handles GET requests to /api/auth/* endpoints
 */
/**
 * Exported POST handler for authentication requests
 * @type {import("next-auth").AuthHandler}
 * @description Handles POST requests to /api/auth/* endpoints
 */
export { handler as GET, handler as POST };
