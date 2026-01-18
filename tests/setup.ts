// Set required environment variables for tests before any imports
process.env["PORT"] = process.env["PORT"] || "3000";
process.env["NODE_ENV"] = process.env["NODE_ENV"] || "test";
process.env["LOG_LEVEL"] = process.env["LOG_LEVEL"] || "error";
process.env["APP_VERSION"] = process.env["APP_VERSION"] || "1.0.0";
process.env["APP_NAME"] = process.env["APP_NAME"] || "credlock-test";
process.env["BASE_URL"] = process.env["BASE_URL"] || "http://localhost";
process.env["CORS_ORIGINS"] =
  process.env["CORS_ORIGINS"] || "http://localhost:3000";
process.env["JWT_SECRET"] = process.env["JWT_SECRET"] || "test-secret-key";
process.env["JWT_EXPIRES_IN"] = process.env["JWT_EXPIRES_IN"] || "15m";
process.env["JWT_REFRESH_SECRET"] =
  process.env["JWT_REFRESH_SECRET"] || "test-refresh-secret";
process.env["JWT_REFRESH_EXPIRES_IN"] =
  process.env["JWT_REFRESH_EXPIRES_IN"] || "7d";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] || "postgresql://localhost:5432/test";
process.env["DIRECT_URL"] =
  process.env["DIRECT_URL"] || "postgresql://localhost:5432/test";
process.env["EMAIL_HOST"] = process.env["EMAIL_HOST"] || "smtp.test.com";
process.env["EMAIL_PORT"] = process.env["EMAIL_PORT"] || "587";
process.env["EMAIL_SECURE"] = process.env["EMAIL_SECURE"] || "false";
process.env["EMAIL_USER"] = process.env["EMAIL_USER"] || "test@example.com";
process.env["EMAIL_PASSWORD"] =
  process.env["EMAIL_PASSWORD"] || "test-password";
process.env["EMAIL_FROM"] = process.env["EMAIL_FROM"] || "test@example.com";
process.env["BCRYPT_ROUNDS"] = process.env["BCRYPT_ROUNDS"] || "10";
process.env["MAX_LOGIN_ATTEMPTS"] = process.env["MAX_LOGIN_ATTEMPTS"] || "5";
process.env["LOCK_TIME"] = process.env["LOCK_TIME"] || "30";
process.env["MAX_REGISTRATION_ATTEMPTS"] =
  process.env["MAX_REGISTRATION_ATTEMPTS"] || "5";
process.env["REGISTRATION_LOCK_TIME"] =
  process.env["REGISTRATION_LOCK_TIME"] || "30";
process.env["RATE_LIMIT_WINDOW"] = process.env["RATE_LIMIT_WINDOW"] || "15";
process.env["RATE_LIMIT_MAX_REQUESTS"] =
  process.env["RATE_LIMIT_MAX_REQUESTS"] || "100";
process.env["DISCORD_WEBHOOK_URL"] =
  process.env["DISCORD_WEBHOOK_URL"] || "https://discord.test/webhook";
process.env["GOOGLE_CLIENT_ID"] =
  process.env["GOOGLE_CLIENT_ID"] || "test-google-client-id";
process.env["GOOGLE_CLIENT_SECRET"] =
  process.env["GOOGLE_CLIENT_SECRET"] || "test-google-client-secret";
process.env["GOOGLE_CALLBACK_URL"] =
  process.env["GOOGLE_CALLBACK_URL"] ||
  "http://localhost:3000/auth/google/callback";
process.env["GITHUB_CLIENT_ID"] =
  process.env["GITHUB_CLIENT_ID"] || "test-github-client-id";
process.env["GITHUB_CLIENT_SECRET"] =
  process.env["GITHUB_CLIENT_SECRET"] || "test-github-client-secret";
process.env["GITHUB_CALLBACK_URL"] =
  process.env["GITHUB_CALLBACK_URL"] ||
  "http://localhost:3000/auth/github/callback";
process.env["LOKI_ENABLED"] = process.env["LOKI_ENABLED"] || "false";
process.env["LOKI_HOST"] = process.env["LOKI_HOST"] || "http://localhost:3100";

import { prisma } from "../src/config/prisma";

// Global teardown - disconnect Prisma after all tests
afterAll(async () => {
  try {
    // Only disconnect if prisma has the $disconnect method (not mocked)
    if (prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  } catch (error) {
    // Silently handle any errors during cleanup
    console.error("Error disconnecting Prisma:", error);
  }
});

// Set a shorter timeout for Jest to prevent hanging
jest.setTimeout(10000);
