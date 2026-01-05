import {
  hashPassword,
  comparePassword,
  generateVerificationToken,
  isAccountLocked,
} from "../../src/helpers/user";
import { config } from "../../src/config/app";

jest.mock("../../src/config/app");
jest.mock("bcryptjs");

const mockedConfig = config as jest.Mocked<typeof config>;

// Helper function to create clean mock users with PostgreSQL schema
const createMockUser = (overrides: Partial<any> = {}) => {
  const defaultUser = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fullname: "John Doe",
    email: "test@example.com",
    phone: null,
    service: "examaxis",
    profile_image: null,
    is_active: true,
    last_login_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    email_info: {
      id: "email-info-id",
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      is_verified: false,
      verification_token: null,
      verification_expires: null,
      pending_email: null,
      provider: "local",
      created_at: new Date(),
      updated_at: new Date(),
    },
    phone_info: null,
    password_info: {
      id: "password-info-id",
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      hash: "hashedPassword123",
      reset_token: null,
      reset_expires: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    lockout_info: {
      id: "lockout-info-id",
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      is_locked: false,
      locked_until: null,
      failed_attempt_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
  };

  // Deep merge overrides
  const mergedUser = { ...defaultUser };
  for (const key of Object.keys(overrides)) {
    if (typeof overrides[key] === "object" && overrides[key] !== null && !Array.isArray(overrides[key])) {
      (mergedUser as any)[key] = { ...(defaultUser as any)[key], ...overrides[key] };
    } else {
      (mergedUser as any)[key] = overrides[key];
    }
  }

  return mergedUser as any;
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
      expect(bcrypt.hash).toHaveBeenCalledWith(password, "salt123");
    });
  });

  describe("comparePassword", () => {
    it("should compare password with hash successfully", async () => {
      const mockUser = createMockUser();
      const inputPassword = "testPassword123";

      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(true);

      const result = await comparePassword(
        mockUser.password_info.hash,
        inputPassword
      );

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        inputPassword,
        "hashedPassword123"
      );
    });

    it("should return false for incorrect password", async () => {
      const mockUser = createMockUser();
      const inputPassword = "wrongPassword";

      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(false);

      const result = await comparePassword(
        mockUser.password_info.hash,
        inputPassword
      );

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        inputPassword,
        "hashedPassword123"
      );
    });
  });

  describe("generateVerificationToken", () => {
    it("should generate email verification token with days", async () => {
      const result = generateVerificationToken(1, "days");

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

    it("should generate phone verification token with minutes", async () => {
      const result = generateVerificationToken(10, "minutes");

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

    it("should default to minutes when unit is not specified", async () => {
      const result = generateVerificationToken(10);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.hashed).toBeDefined();
      expect(result.expires).toBeDefined();
      expect(result.expires instanceof Date).toBe(true);
    });

    it("should generate different tokens for each call", async () => {
      const result1 = generateVerificationToken(1, "days");
      const result2 = generateVerificationToken(1, "days");

      expect(result1.token).not.toBe(result2.token);
      expect(result1.hashed).not.toBe(result2.hashed);
    });
  });

  describe("isAccountLocked", () => {
    it("should return false for unlocked account", () => {
      const mockUser = createMockUser();
      const result = isAccountLocked(mockUser);
      expect(result).toBe(false);
    });

    it("should return true for locked account", () => {
      const mockUser = createMockUser({
        lockout_info: {
          id: "lockout-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_locked: true,
          locked_until: new Date(Date.now() + 1000), // Lock expires in 1 second
          failed_attempt_count: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const result = isAccountLocked(mockUser);
      expect(result).toBe(true);
    });
  });
});
