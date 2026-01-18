import {
  hashPassword,
  comparePassword,
  generateVerificationToken,
  isAccountLocked,
  serializeUser,
} from "../../src/helpers/user";
import { config } from "../../src/config/app";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("../../src/config/app");
jest.mock("bcryptjs");

const mockedConfig = config as jest.Mocked<typeof config>;

// Helper function to create clean mock users
const createMockUser = (overrides: Partial<User> = {}): User => {
  const defaultUser: User = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "John Doe",
    email: "test@example.com",
    phone: null,
    avatar: null,
    provider: "local",
    serviceId: "examaxis",
    lastLoginAt: new Date("2024-01-01T00:00:00.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  };

  return { ...defaultUser, ...overrides };
};

describe("User Helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConfig.security = {
      bcryptRounds: 12,
      maxLoginAttempts: 5,
      loginLockTime: 3600000,
      maxRegistrationAttempts: 3,
      registrationLockTime: 3600000,
    };
  });

  describe("serializeUser", () => {
    it("should serialize user with all optional fields present", () => {
      const mockUser = createMockUser({
        phone: "+1234567890",
        avatar: "https://example.com/avatar.jpg",
      });

      const result = serializeUser(mockUser);

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        phone: mockUser.phone,
        avatar: mockUser.avatar,
        provider: mockUser.provider,
        lastLoginAt: mockUser.lastLoginAt,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it("should exclude null optional fields", () => {
      const mockUser = createMockUser();

      const result = serializeUser(mockUser);

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        provider: mockUser.provider,
        lastLoginAt: mockUser.lastLoginAt,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty("phone");
      expect(result).not.toHaveProperty("avatar");
    });

    it("should exclude sensitive fields", () => {
      const mockUser = createMockUser();

      const result = serializeUser(mockUser);

      // These fields should not be included in serialized output
      // Password and other sensitive data are now in separate related models
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("emailToken");
      expect(result).not.toHaveProperty("emailExpires");
      expect(result).not.toHaveProperty("resetToken");
      expect(result).not.toHaveProperty("resetExpires");
      expect(result).not.toHaveProperty("isLocked");
      expect(result).not.toHaveProperty("lockedUntil");
      expect(result).not.toHaveProperty("failedAttempts");
    });
  });

  describe("hashPassword", () => {
    it("should hash password with configured rounds", async () => {
      const password = "testPassword123";
      const hashedPassword = "hashedPassword123";

      const bcrypt = require("bcryptjs");
      bcrypt.genSalt.mockResolvedValue("salt123");
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(
        mockedConfig.security.bcryptRounds
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(password, "salt123");
    });

    it("should handle empty password", async () => {
      const password = "";
      const hashedPassword = "hashedEmptyPassword";

      const bcrypt = require("bcryptjs");
      bcrypt.genSalt.mockResolvedValue("salt123");
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(
        mockedConfig.security.bcryptRounds
      );
    });
  });

  describe("comparePassword", () => {
    it("should return true for matching password", async () => {
      const inputPassword = "testPassword123";
      const storedHash = "hashedPassword123";

      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(true);

      const result = await comparePassword(storedHash, inputPassword);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(inputPassword, storedHash);
    });

    it("should return false for incorrect password", async () => {
      const inputPassword = "wrongPassword";
      const storedHash = "hashedPassword123";

      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(false);

      const result = await comparePassword(storedHash, inputPassword);

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(inputPassword, storedHash);
    });

    it("should return false for null hash", async () => {
      const inputPassword = "testPassword123";

      const result = await comparePassword(null, inputPassword);

      expect(result).toBe(false);
    });
  });

  describe("generateVerificationToken", () => {
    it("should generate token with expiry in minutes", () => {
      const duration = 30;

      const result = generateVerificationToken(duration);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.hashed).toBeDefined();
      expect(result.expires).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(typeof result.hashed).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.hashed.length).toBeGreaterThan(0);
      expect(result.expires instanceof Date).toBe(true);
    });

    it("should generate unique tokens each time", () => {
      const result1 = generateVerificationToken(30);
      const result2 = generateVerificationToken(30);

      expect(result1.token).not.toBe(result2.token);
      expect(result1.hashed).not.toBe(result2.hashed);
    });

    it("should generate different hashed values for different tokens", () => {
      const result1 = generateVerificationToken(30);
      const result2 = generateVerificationToken(30);

      expect(result1.hashed).not.toBe(result2.hashed);
    });

    it("should set expiry in the future", () => {
      const duration = 60;
      const beforeTime = new Date();

      const result = generateVerificationToken(duration);

      const afterTime = new Date(
        beforeTime.getTime() + duration * 60 * 1000 + 1000
      );
      expect(result.expires.getTime()).toBeGreaterThan(beforeTime.getTime());
      expect(result.expires.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("isAccountLocked", () => {
    it("should return false when lockedUntil is null", () => {
      const result = isAccountLocked(null);

      expect(result).toBe(false);
    });

    it("should return true when lockedUntil is in the future", () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      const result = isAccountLocked(futureDate);

      expect(result).toBe(true);
    });

    it("should return false when lockedUntil is in the past", () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

      const result = isAccountLocked(pastDate);

      expect(result).toBe(false);
    });

    it("should return false when lockedUntil is exactly now", () => {
      const now = new Date();

      const result = isAccountLocked(now);

      expect(result).toBe(false);
    });
  });
});
