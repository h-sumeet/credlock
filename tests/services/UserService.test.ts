import * as UserService from "../../src/services/UserService";
import * as EmailService from "../../src/services/EmailService";
import * as UserHelpers from "../../src/helpers/user";
import { prisma } from "../../src/config/prisma";
import type { UserDetails } from "../../src/types/user";

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
    },
    passwordInfo: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    lockoutInfo: {
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));
jest.mock("../../src/services/EmailService");
jest.mock("../../src/services/SessionService");
jest.mock("../../src/helpers/user");

const mockedPrisma = {
  user: {
    findFirst: prisma.user.findFirst as jest.MockedFunction<any>,
    findUnique: prisma.user.findUnique as jest.MockedFunction<any>,
    create: prisma.user.create as jest.MockedFunction<any>,
    update: prisma.user.update as jest.MockedFunction<any>,
    delete: prisma.user.delete as jest.MockedFunction<any>,
  },
  emailInfo: {
    findFirst: prisma.emailInfo.findFirst as jest.MockedFunction<any>,
    update: prisma.emailInfo.update as jest.MockedFunction<any>,
  },
  passwordInfo: {
    findFirst: prisma.passwordInfo.findFirst as jest.MockedFunction<any>,
    update: prisma.passwordInfo.update as jest.MockedFunction<any>,
    upsert: prisma.passwordInfo.upsert as jest.MockedFunction<any>,
  },
  lockoutInfo: {
    update: prisma.lockoutInfo.update as jest.MockedFunction<any>,
    upsert: prisma.lockoutInfo.upsert as jest.MockedFunction<any>,
  },
};
const mockedEmailService = EmailService as jest.Mocked<typeof EmailService>;
const mockedUserHelpers = UserHelpers as jest.Mocked<typeof UserHelpers>;

// Helper function to create clean mock user objects with PostgreSQL schema
const createMockUser = (overrides: Partial<any> = {}): UserDetails => {
  const defaultUser: UserDetails = {
    id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
    fullname: "John Doe",
    email: "john@example.com",
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
      hash: "hashedpassword",
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
    if (
      typeof overrides[key] === "object" &&
      overrides[key] !== null &&
      !Array.isArray(overrides[key])
    ) {
      (mergedUser as any)[key] = {
        ...(defaultUser as any)[key],
        ...overrides[key],
      };
    } else {
      (mergedUser as any)[key] = overrides[key];
    }
  }

  return mergedUser;
};

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
    mockedUserHelpers.isAccountLocked.mockImplementation((user: any) => {
      return !!(
        user?.lockout_info?.is_locked &&
        user?.lockout_info?.locked_until &&
        new Date(user.lockout_info.locked_until).getTime() > Date.now()
      );
    });
    mockedUserHelpers.comparePassword.mockResolvedValue(true);
  });

  describe("checkUserExists", () => {
    it("should return false when user does not exist", async () => {
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      const result = await UserService.checkUserExists(
        "test@example.com",
        undefined,
        "examaxis"
      );

      expect(result).toEqual({ exists: false });
    });

    it("should return true with email field when user exists by email", async () => {
      const mockUser = createMockUser({
        email: "test@example.com",
        service: "examaxis",
      });

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await UserService.checkUserExists(
        "test@example.com",
        undefined,
        "examaxis"
      );

      expect(result).toEqual({ exists: true, user: mockUser, field: "email" });
    });

    it("should return true with phone field when user exists by phone", async () => {
      const mockUser = createMockUser({
        email: "other@example.com",
        phone: "+1234567890",
        service: "examaxis",
      });

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await UserService.checkUserExists(
        "test@example.com",
        "+1234567890",
        "examaxis"
      );

      expect(result).toEqual({ exists: true, user: mockUser, field: "phone" });
    });
  });

  describe("createUserWithVerification", () => {
    it("should create user with email verification token", async () => {
      const mockUser = createMockUser();

      mockedPrisma.user.create.mockResolvedValue(mockUser);

      const result = await UserService.createUserWithVerification(
        "John Doe",
        "john@example.com",
        undefined,
        "password123",
        "examaxis"
      );

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullname: "John Doe",
          email: "john@example.com",
          service: "examaxis",
          email_info: {
            create: expect.objectContaining({
              is_verified: false,
              verification_token: expect.any(String),
              verification_expires: expect.any(Date),
            }),
          },
          password_info: {
            create: expect.objectContaining({
              hash: expect.any(String),
            }),
          },
          lockout_info: {
            create: expect.objectContaining({
              is_locked: false,
              failed_attempt_count: 0,
            }),
          },
        }),
        include: expect.any(Object),
      });
      expect(result.user).toBeDefined();
      expect(result.verificationToken).toBeDefined();
    });

    it("should create user with phone number when provided", async () => {
      const mockUser = createMockUser({
        phone: "+1234567890",
      });

      mockedPrisma.user.create.mockResolvedValue(mockUser);

      const result = await UserService.createUserWithVerification(
        "John Doe",
        "john@example.com",
        "+1234567890",
        "password123",
        "service-name"
      );

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullname: "John Doe",
          service: "service-name",
          email: "john@example.com",
          phone: "+1234567890",
          email_info: {
            create: expect.objectContaining({
              is_verified: false,
              verification_token: expect.any(String),
              verification_expires: expect.any(Date),
            }),
          },
          phone_info: {
            create: expect.objectContaining({
              is_verified: false,
            }),
          },
        }),
        include: expect.any(Object),
      });
      expect(result.user).toBeDefined();
      expect(result.verificationToken).toBeDefined();
    });
  });

  describe("verifyEmailWithToken", () => {
    it("should verify email successfully", async () => {
      const mockUser = createMockUser({
        email_info: {
          id: "email-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_verified: false,
          verification_token: "hashed-token",
          verification_expires: new Date(Date.now() + 3600000),
          pending_email: null,
          provider: "local",
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const mockEmailInfo = {
        ...mockUser.email_info,
        user: mockUser,
      };

      mockedPrisma.emailInfo.findFirst.mockResolvedValue(mockEmailInfo);
      mockedPrisma.emailInfo.update.mockResolvedValue(mockEmailInfo);
      mockedPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_info: { ...mockUser.email_info, is_verified: true },
      });

      const result = await UserService.verifyEmailWithToken("token123");

      expect(mockedPrisma.emailInfo.update).toHaveBeenCalled();
      expect(result.user).toBeDefined();
      expect(result.isNewlyVerified).toBe(true);
    });

    it("should return error for invalid token", async () => {
      mockedPrisma.emailInfo.findFirst.mockResolvedValue(null);

      await expect(
        UserService.verifyEmailWithToken("invalid-token")
      ).rejects.toThrow("Invalid or expired email verification token");
    });
  });

  describe("authenticateUser", () => {
    it("should return invalid when user is not found", async () => {
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      const result = await UserService.authenticateUser(
        "missing@example.com",
        "password123",
        "examaxis"
      );

      expect(result).toEqual({ user: null, isValid: false });
    });

    it("should throw 403 for social account without password", async () => {
      const mockUser = createMockUser({
        email_info: {
          id: "email-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_verified: true,
          verification_token: null,
          verification_expires: null,
          pending_email: null,
          provider: "google",
          created_at: new Date(),
          updated_at: new Date(),
        },
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: null,
          reset_token: null,
          reset_expires: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        UserService.authenticateUser("john@example.com", "any", "examaxis")
      ).rejects.toMatchObject({
        message:
          "You signed in with a social account. To log in with a password, please set one using 'Forgot Password'.",
        code: 403,
      });
    });

    it("should throw 403 when email is not verified", async () => {
      const mockUser = createMockUser({
        email_info: {
          id: "email-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_verified: false,
          verification_token: null,
          verification_expires: null,
          pending_email: null,
          provider: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        UserService.authenticateUser(
          "john@example.com",
          "password123",
          "examaxis"
        )
      ).rejects.toMatchObject({
        message: "Please verify your email before logging in",
        code: 403,
      });
    });

    it("should throw 423 when account is locked", async () => {
      const mockUser = createMockUser({
        email_info: {
          id: "email-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_verified: true,
          verification_token: null,
          verification_expires: null,
          pending_email: null,
          provider: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        lockout_info: {
          id: "lockout-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_locked: true,
          locked_until: new Date(Date.now() + 60 * 60 * 1000),
          failed_attempt_count: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockedUserHelpers.isAccountLocked.mockReturnValue(true);

      await expect(
        UserService.authenticateUser(
          "john@example.com",
          "password123",
          "examaxis"
        )
      ).rejects.toMatchObject({
        message:
          "Account is temporarily locked due to multiple failed login attempts",
        code: 423,
      });
    });

    it("should authenticate successfully and update lastLogin", async () => {
      const mockUser = createMockUser({
        email_info: {
          id: "email-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_verified: true,
          verification_token: null,
          verification_expires: null,
          pending_email: null,
          provider: null,
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
      });

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockedPrisma.user.update.mockResolvedValue(mockUser);
      mockedUserHelpers.comparePassword.mockResolvedValue(true);

      const result = await UserService.authenticateUser(
        "john@example.com",
        "password123",
        "examaxis"
      );

      expect(result).toEqual({ user: mockUser, isValid: true });
      expect(mockedPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe("incrementFailedLoginAttempts", () => {
    it("should increment failed login attempts", async () => {
      const mockUser = createMockUser();
      mockedPrisma.lockoutInfo.upsert.mockResolvedValue({} as any);

      await UserService.incrementFailedLoginAttempts(mockUser);

      expect(mockedPrisma.lockoutInfo.upsert).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        update: expect.objectContaining({
          failed_attempt_count:
            (mockUser.lockout_info?.failed_attempt_count ?? 0) + 1,
          is_locked: false,
        }),
        create: expect.objectContaining({
          user_id: mockUser.id,
          failed_attempt_count: 1,
          is_locked: false,
        }),
      });
    });

    it("should lock account when max attempts reached", async () => {
      const mockUser = createMockUser({
        lockout_info: {
          id: "lockout-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_locked: false,
          locked_until: null,
          failed_attempt_count: 4,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      mockedPrisma.lockoutInfo.upsert.mockResolvedValue({} as any);

      await UserService.incrementFailedLoginAttempts(mockUser);

      expect(mockedPrisma.lockoutInfo.upsert).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        update: expect.objectContaining({
          is_locked: true,
          locked_until: expect.any(Date),
          failed_attempt_count: 5,
        }),
        create: expect.objectContaining({
          user_id: mockUser.id,
          is_locked: true,
          locked_until: expect.any(Date),
          failed_attempt_count: 5,
        }),
      });
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email for existing user", async () => {
      const mockUser = createMockUser();

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockedPrisma.passwordInfo.upsert.mockResolvedValue(
        mockUser.password_info as any
      );
      mockedEmailService.sendEmail.mockResolvedValue();

      await UserService.sendPasswordResetEmail(
        "john@example.com",
        "https://example.com/reset",
        "examaxis"
      );

      expect(mockedPrisma.passwordInfo.upsert).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        update: {
          reset_token: expect.any(String),
          reset_expires: expect.any(Date),
        },
        create: {
          user_id: mockUser.id,
          reset_token: expect.any(String),
          reset_expires: expect.any(Date),
        },
      });
      expect(mockedEmailService.sendEmail).toHaveBeenCalledWith(
        "john@example.com",
        expect.objectContaining({
          subject: expect.stringContaining("Password Reset"),
          html: expect.stringContaining("Password Reset Request"),
          text: expect.stringContaining("Password Reset Request"),
        })
      );
    });

    it("should handle non-existent user silently", async () => {
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        UserService.sendPasswordResetEmail(
          "nonexistent@example.com",
          "https://example.com/reset",
          "examaxis"
        )
      ).resolves.toBeUndefined();

      expect(mockedEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPasswordWithToken", () => {
    it("should reset password successfully for verified user", async () => {
      const mockUser = createMockUser({
        email_info: {
          id: "email-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          is_verified: true,
          verification_token: null,
          verification_expires: null,
          pending_email: null,
          provider: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: "oldhashedpassword",
          reset_token: "hashed-reset-token",
          reset_expires: new Date(Date.now() + 3600000),
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const mockPasswordInfo = {
        ...mockUser.password_info,
        user: mockUser,
      };

      mockedPrisma.passwordInfo.findFirst.mockResolvedValue(mockPasswordInfo);
      mockedPrisma.passwordInfo.update.mockResolvedValue({} as any);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashedpassword");

      await UserService.resetPasswordWithToken("reset-token", "newpassword123");

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "newpassword123"
      );
      expect(mockedPrisma.passwordInfo.update).toHaveBeenCalled();
    });

    it("should throw error for invalid or expired token", async () => {
      mockedPrisma.passwordInfo.findFirst.mockResolvedValue(null);

      await expect(
        UserService.resetPasswordWithToken("invalid-token", "newpassword123")
      ).rejects.toThrow("Invalid or expired password reset token");
    });
  });

  describe("updateUserProfile", () => {
    it("should update fullname successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = createMockUser({ fullname: "Jane Doe" });

      mockedPrisma.user.findFirst.mockResolvedValue(null); // No conflicts
      mockedPrisma.user.update.mockResolvedValue(updatedUser);
      mockedPrisma.user.findUnique.mockResolvedValue(updatedUser);

      const result = await UserService.updateUserProfile(mockUser, {
        fullname: "Jane Doe",
      });

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { fullname: "Jane Doe" },
      });
      expect(result).toEqual({
        user: updatedUser,
        message: "Profile updated successfully",
      });
    });

    it("should update password successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = createMockUser({
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: "newhashed",
          reset_token: null,
          reset_expires: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(null);
      mockedPrisma.passwordInfo.upsert.mockResolvedValue({} as any);
      mockedPrisma.user.findUnique.mockResolvedValue(updatedUser);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashed");

      const result = await UserService.updateUserProfile(mockUser, {
        password: "newpassword123",
      });

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "newpassword123"
      );
      expect(mockedPrisma.passwordInfo.upsert).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        update: {
          hash: "newhashed",
        },
        create: {
          user_id: mockUser.id,
          hash: "newhashed",
        },
      });
      expect(result).toEqual({
        user: updatedUser,
        message: "Password updated successfully",
      });
    });

    it("should handle empty updates gracefully", async () => {
      const mockUser = createMockUser();

      mockedPrisma.user.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserService.updateUserProfile(mockUser, {});

      // Should not call update if no fields to update
      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        user: mockUser,
        message: "Profile updated successfully",
      });
    });
  });
});
