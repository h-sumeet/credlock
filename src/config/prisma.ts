import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "./app"

// Prevent multiple instances in development
declare global {
  var prisma: PrismaClient | undefined;
}

const connectionString = config.postgresqlUrl;
const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") globalThis.prisma = prisma;

export default prisma;
