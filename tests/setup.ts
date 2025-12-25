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
