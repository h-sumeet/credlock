// Mock config before importing modules that use it
jest.mock("../../src/config/app", () => ({
  config: {
    nodeEnv: "test",
    version: "1.0.0",
    port: 3000,
    logLevel: "info",
    app: { name: "TestApp", url: "http://localhost" },
    jwt: {
      secret: "test",
      refreshSecret: "test",
      expiresIn: "15m",
      refreshExpiresIn: "7d",
    },
    security: {
      bcryptRounds: 10,
      maxLoginAttempts: 5,
      loginLockTime: 3600000,
      maxRegistrationAttempts: 3,
      registrationLockTime: 3600000,
    },
    services: {
      examaxis: {
        email: {
          host: "smtp.example.com",
          port: 587,
          secure: true,
          user: "test@example.com",
          password: "password",
          from: "noreply@example.com",
        },
        oauth: {
          google: {
            clientId: "id",
            clientSecret: "secret",
            callbackUrl: "url",
          },
          github: {
            clientId: "id",
            clientSecret: "secret",
            callbackUrl: "url",
          },
        },
      },
    },
  },
}));

import * as UserService from "../../src/services/UserService";
import * as UserHelpers from "../../src/helpers/user";
import { prisma } from "../../src/config/prisma";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    emailInfo: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    passwordInfo: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    lockoutInfo: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    inactiveUser: {
      create: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));
jest.mock("../../src/services/EmailService");
jest.mock("../../src/services/SessionService");
jest.mock("../../src/helpers/user");
jest.mock("../../src/helpers/logger");
jest.mock("../../src/templates/emailTemplates");

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedUserHelpers = UserHelpers as jest.Mocked<typeof UserHelpers>;

// Helper function to create mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "John Doe",
  email: "john@example.com",
  phone: null,
  serviceId: "examaxis",
  avatar: null,
  provider: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default helper mocks
    mockedUserHelpers.hashPassword.mockResolvedValue("hashedpassword");
    mockedUserHelpers.generateVerificationToken.mockReturnValue({
      token: "email-token-123",
      hashed: "hashed-email-token",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    mockedUserHelpers.isAccountLocked.mockReturnValue(false);
    mockedUserHelpers.comparePassword.mockResolvedValue(true);
  });

  describe("checkUserExists", () => {
    it("should return false when user does not exist", async () => {
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await UserService.checkUserExists(
        "test@example.com",
        "examaxis"
      );

      expect(result).toEqual({ exists: false });
    });

    it("should return true when verified user exists", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailInfo: { isVerified: true },
      });

      const result = await UserService.checkUserExists(
        "test@example.com",
        "examaxis"
      );

      expect(result).toEqual({ exists: true, user: expect.any(Object) });
    });

    it("should delete unverified user and return false", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailInfo: { isVerified: false },
      });
      (mockedPrisma.user.delete as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.checkUserExists(
        "test@example.com",
        "examaxis"
      );

      expect(mockedPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).toEqual({ exists: false });
    });
  });

  describe("getUserById", () => {
    it("should return user when found", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getUserById(mockUser.id);

      expect(result).toEqual(mockUser);
    });

    it("should throw error when user not found", async () => {
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(UserService.getUserById("non-existent-id")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("deleteUserById", () => {
    it("should delete user by id", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.delete as jest.Mock).mockResolvedValue(mockUser);

      await UserService.deleteUserById(mockUser.id);

      expect(mockedPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });
  });

  describe("createUserWithVerification", () => {
    it("should create user and send verification email", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.createUserWithVerification(
        "John Doe",
        "john@example.com",
        undefined,
        "Password123!",
        "examaxis",
        "https://example.com/verify"
      );

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "Password123!"
      );
      expect(mockedUserHelpers.generateVerificationToken).toHaveBeenCalled();
      expect(mockedPrisma.user.create).toHaveBeenCalled();
      expect(result.message).toContain("User registered successfully");
    });

    it("should create user with phone number", async () => {
      const mockUser = createMockUser({ phone: "+1234567890" });
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await UserService.createUserWithVerification(
        "John Doe",
        "john@example.com",
        "+1234567890",
        "Password123!",
        "examaxis",
        "https://example.com/verify"
      );

      expect(mockedPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: "+1234567890",
          }),
        })
      );
    });

    it("should throw error if user already exists", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailInfo: { isVerified: true },
      });

      await expect(
        UserService.createUserWithVerification(
          "John Doe",
          "john@example.com",
          undefined,
          "Password123!",
          "examaxis",
          "https://example.com/verify"
        )
      ).rejects.toThrow("User with this email already exists");
    });
  });

  describe("verifyEmailWithToken", () => {
    it("should verify email and return user", async () => {
      const mockUser = createMockUser();
      const mockEmailInfo = {
        id: "email-info-id",
        userId: mockUser.id,
        pendingEmail: null,
      };

      (mockedPrisma.emailInfo.findFirst as jest.Mock).mockResolvedValue(
        mockEmailInfo
      );
      (mockedPrisma.emailInfo.update as jest.Mock).mockResolvedValue(
        mockEmailInfo
      );
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.verifyEmailWithToken("valid-token");

      expect(mockedPrisma.emailInfo.update).toHaveBeenCalledWith({
        where: { id: mockEmailInfo.id },
        data: {
          isVerified: true,
          token: null,
          tokenExpires: null,
        },
      });
      expect(result.user).toEqual(mockUser);
    });

    it("should update email when pendingEmail exists", async () => {
      const mockUser = createMockUser();
      const mockEmailInfo = {
        id: "email-info-id",
        userId: mockUser.id,
        pendingEmail: "newemail@example.com",
      };

      (mockedPrisma.emailInfo.findFirst as jest.Mock).mockResolvedValue(
        mockEmailInfo
      );
      (mockedPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (mockedPrisma.emailInfo.update as jest.Mock).mockResolvedValue(
        mockEmailInfo
      );
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await UserService.verifyEmailWithToken("valid-token");

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { email: "newemail@example.com" },
      });
    });

    it("should throw error for invalid token", async () => {
      (mockedPrisma.emailInfo.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.verifyEmailWithToken("invalid-token")
      ).rejects.toThrow("Invalid or expired email verification token");
    });
  });

  describe("authenticateUser", () => {
    it("should authenticate user successfully", async () => {
      const mockUser = createMockUser();
      const mockUserData = {
        id: mockUser.id,
        provider: null,
        passwordInfo: { hash: "hashedpassword" },
        lockoutInfo: null,
        emailInfo: { isVerified: true },
      };

      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockUserData
      );
      (mockedPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.authenticateUser(
        "john@example.com",
        "Password123!",
        "examaxis"
      );

      expect(result.user).toEqual(mockUser);
    });

    it("should throw error when user not found", async () => {
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.authenticateUser(
          "nonexistent@example.com",
          "password",
          "examaxis"
        )
      ).rejects.toThrow("Invalid email or password!");
    });

    it("should throw error when email not verified", async () => {
      const mockUserData = {
        id: "user-id",
        provider: null,
        passwordInfo: { hash: "hashedpassword" },
        lockoutInfo: null,
        emailInfo: { isVerified: false },
      };

      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserData
      );

      await expect(
        UserService.authenticateUser("john@example.com", "password", "examaxis")
      ).rejects.toThrow("Please verify your email before logging in");
    });

    it("should throw error when account is locked", async () => {
      const mockUserData = {
        id: "user-id",
        provider: null,
        passwordInfo: { hash: "hashedpassword" },
        lockoutInfo: { lockedUntil: new Date(Date.now() + 3600000) },
        emailInfo: { isVerified: true },
      };

      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserData
      );
      mockedUserHelpers.isAccountLocked.mockReturnValue(true);

      await expect(
        UserService.authenticateUser("john@example.com", "password", "examaxis")
      ).rejects.toThrow("This account is locked");
    });

    it("should throw error for OAuth user without password", async () => {
      const mockUserData = {
        id: "user-id",
        provider: "google",
        passwordInfo: { hash: null },
        lockoutInfo: null,
        emailInfo: { isVerified: true },
      };

      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserData
      );

      await expect(
        UserService.authenticateUser("john@example.com", "password", "examaxis")
      ).rejects.toThrow("This account is linked to google");
    });

    it("should throw error for incorrect password", async () => {
      const mockUserData = {
        id: "user-id",
        provider: null,
        passwordInfo: { hash: "hashedpassword" },
        lockoutInfo: null,
        emailInfo: { isVerified: true },
      };

      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserData
      );
      mockedUserHelpers.comparePassword.mockResolvedValue(false);

      await expect(
        UserService.authenticateUser(
          "john@example.com",
          "wrongpassword",
          "examaxis"
        )
      ).rejects.toThrow("Invalid email or password!");
    });
  });

  describe("incrementFailedLoginAttempts", () => {
    it("should increment failed login attempts", async () => {
      (mockedPrisma.lockoutInfo.findUnique as jest.Mock).mockResolvedValue({
        failedAttemptCount: 1,
      });
      (mockedPrisma.lockoutInfo.upsert as jest.Mock).mockResolvedValue({});

      await UserService.incrementFailedLoginAttempts("user-id");

      expect(mockedPrisma.lockoutInfo.upsert).toHaveBeenCalled();
    });

    it("should create lockout info if not exists", async () => {
      (mockedPrisma.lockoutInfo.findUnique as jest.Mock).mockResolvedValue(
        null
      );
      (mockedPrisma.lockoutInfo.upsert as jest.Mock).mockResolvedValue({});

      await UserService.incrementFailedLoginAttempts("user-id");

      expect(mockedPrisma.lockoutInfo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            failedAttemptCount: 1,
          }),
        })
      );
    });
  });

  describe("resetFailedLoginAttempts", () => {
    it("should reset failed login attempts", async () => {
      (mockedPrisma.lockoutInfo.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await UserService.resetFailedLoginAttempts("user-id");

      expect(mockedPrisma.lockoutInfo.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-id" },
      });
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailInfo: { isVerified: true },
      });
      (mockedPrisma.passwordInfo.upsert as jest.Mock).mockResolvedValue({});

      await UserService.sendPasswordResetEmail(
        "john@example.com",
        "https://example.com/reset",
        "examaxis"
      );

      expect(mockedPrisma.passwordInfo.upsert).toHaveBeenCalled();
    });

    it("should throw error when user not found", async () => {
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.sendPasswordResetEmail(
          "nonexistent@example.com",
          "https://example.com/reset",
          "examaxis"
        )
      ).rejects.toThrow("Don't have an account with that email");
    });
  });

  describe("resetPasswordWithToken", () => {
    it("should reset password successfully", async () => {
      const mockPasswordInfo = {
        userId: "user-id",
      };

      (mockedPrisma.passwordInfo.findFirst as jest.Mock).mockResolvedValue(
        mockPasswordInfo
      );
      (mockedPrisma.passwordInfo.update as jest.Mock).mockResolvedValue({});
      (mockedPrisma.lockoutInfo.deleteMany as jest.Mock).mockResolvedValue({});

      await UserService.resetPasswordWithToken(
        "valid-token",
        "NewPassword123!"
      );

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "NewPassword123!"
      );
      expect(mockedPrisma.passwordInfo.update).toHaveBeenCalled();
    });

    it("should throw error for invalid token", async () => {
      (mockedPrisma.passwordInfo.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      await expect(
        UserService.resetPasswordWithToken("invalid-token", "NewPassword123!")
      ).rejects.toThrow("Invalid or expired password reset token");
    });
  });

  describe("updateUserProfile", () => {
    it("should update profile successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser, name: "Jane Doe" };

      (mockedPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await UserService.updateUserProfile(mockUser.id, {
        name: "Jane Doe",
      });

      expect(result.user).toEqual(updatedUser);
      expect(result.message).toBe("Profile updated successfully");
    });

    it("should update password and revoke sessions", async () => {
      const mockUser = createMockUser();

      (mockedPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.updateUserProfile(mockUser.id, {
        password: "NewPassword123!",
      });

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "NewPassword123!"
      );
      expect(result.message).toContain("Please login again");
    });
  });

  describe("updateEmailWithVerification", () => {
    it("should send verification email for new email", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      (mockedPrisma.emailInfo.upsert as jest.Mock).mockResolvedValue({});

      const result = await UserService.updateEmailWithVerification(
        mockUser.id,
        "examaxis",
        "newemail@example.com",
        "https://example.com/verify"
      );

      expect(mockedPrisma.emailInfo.upsert).toHaveBeenCalled();
      expect(result.message).toContain("Verification email sent");
    });

    it("should throw error if email already in use", async () => {
      const mockUser = createMockUser();
      const existingUser = createMockUser({ email: "taken@example.com" });

      (mockedPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({
          ...existingUser,
          emailInfo: { isVerified: true },
        });

      await expect(
        UserService.updateEmailWithVerification(
          mockUser.id,
          "examaxis",
          "taken@example.com",
          "https://example.com/verify"
        )
      ).rejects.toThrow("Email already in use");
    });
  });

  describe("archiveUserAccount", () => {
    it("should archive user account successfully", async () => {
      const mockUser = createMockUser();
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          await callback({
            inactiveUser: { create: jest.fn() },
            session: { deleteMany: jest.fn() },
            user: { delete: jest.fn() },
          });
        }
      );

      const result = await UserService.archiveUserAccount(mockUser.id);

      expect(result.message).toBe("Account deleted successfully");
    });

    it("should throw error when user not found", async () => {
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.archiveUserAccount("non-existent-id")
      ).rejects.toThrow("User not found");
    });
  });
});
