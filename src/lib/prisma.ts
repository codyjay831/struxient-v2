import { PrismaClient } from "@prisma/client";

/**
 * SAFETY GUARD: Local Development Database Lock
 * Prevents connecting to non-Docker databases during local development.
 */
if (process.env.NODE_ENV === "development") {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.includes("localhost:5433")) {
    const errorMsg = `
[SAFETY GUARD] Local Development Blocked
-----------------------------------------
Your DATABASE_URL does not point to the local Dockerized PostgreSQL (localhost:5433).
To prevent accidental connection to production or remote databases, startup is halted.

Expected: localhost:5433
Actual:   ${dbUrl ? dbUrl.split("@")[1] || "URL present but hidden" : "MISSING"}

Please ensure your .env.local is correctly configured and pointing to the Docker Postgres instance.
`.trim();

    console.error(`\x1b[31m${errorMsg}\x1b[0m`);
    throw new Error(errorMsg);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
