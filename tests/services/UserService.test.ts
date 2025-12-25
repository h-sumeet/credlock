import * as UserService from "../../src/services/UserService";
import * as EmailService from "../../src/services/EmailService";
import * as UserHelpers from "../../src/helpers/user";
import { prisma } from "../../src/config/prisma";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $runCommandRaw: jest.fn(),
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
  },
  $runCommandRaw: prisma.$runCommandRaw as jest.MockedFunction<any>,
};
const mockedEmailService = EmailService as jest.Mocked<typeof EmailService>;
const mockedUserHelpers = UserHelpers as jest.Mocked<typeof UserHelpers>;

// Helper function to create clean mock user objects with only real fields
const createMockUser = (overrides: Partial<any> = {}): any => {
  const defaultUser = {
    id: "507f1f77bcf86cd799439011", // Valid MongoDB ObjectId
    fullname: "John Doe",
    email: "john@example.com",
    phone: null,
    service: "examaxis",
    emailInfo: {
      isVerified: false,
      verificationToken: null,
      verificationExpires: null,
      pendingEmail: null,
      provider: "local",
    },
    phoneInfo: null,
    passwordInfo: {
      hash: "hashedpassword",
      resetToken: null,
      resetExpires: null,
    },
    lockoutInfo: {
      isLocked: false,
      lockedUntil: null,
      failedAttemptCount: 0,
    },
    profileImage: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...defaultUser, ...overrides };
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
        user?.lockoutInfo?.isLocked &&
        user?.lockoutInfo?.lockedUntil &&
        new Date(user.lockoutInfo.lockedUntil).getTime() > Date.now()
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
          emailInfo: expect.objectContaining({
            isVerified: false,
            verificationToken: expect.any(String),
            verificationExpires: expect.any(Date),
          }),
          passwordInfo: expect.objectContaining({
            hash: expect.any(String),
          }),
          lockoutInfo: expect.objectContaining({
            isLocked: false,
            failedAttemptCount: 0,
          }),
        }),
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
          emailInfo: expect.objectContaining({
            isVerified: false,
            verificationToken: expect.any(String),
            verificationExpires: expect.any(Date),
          }),
          passwordInfo: expect.objectContaining({
            hash: expect.any(String),
          }),
          lockoutInfo: expect.objectContaining({
            isLocked: false,
            failedAttemptCount: 0,
          }),
        }),
      });
      expect(result.user).toBeDefined();
      expect(result.verificationToken).toBeDefined();
    });
  });

  describe("verifyEmailWithToken", () => {
    it("should verify email successfully", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          emailAddress: "john@example.com",
          isVerified: false,
          verificationToken: "hashed-token",
          verificationExpires: new Date(Date.now() + 3600000),
          pendingEmail: null,
          provider: "local",
        },
      });

      // Mock $runCommandRaw for finding user with token
      // MongoDB returns documents with _id as { $oid: "string" }
      mockedPrisma.$runCommandRaw.mockResolvedValueOnce({
        cursor: {
          firstBatch: [
            {
              ...mockUser,
              _id: { $oid: mockUser.id },
            },
          ],
        },
      });
      // Mock for duplicate check
      mockedPrisma.$runCommandRaw.mockResolvedValueOnce({
        cursor: {
          firstBatch: [],
        },
      });

      mockedPrisma.user.update.mockResolvedValue({
        ...mockUser,
        emailInfo: { ...mockUser.emailInfo, isVerified: true },
      });

      const result = await UserService.verifyEmailWithToken("token123");

      expect(mockedPrisma.user.update).toHaveBeenCalled();
      expect(result.user).toBeDefined();
      expect(result.isNewlyVerified).toBe(true);
    });

    it("should return error for invalid token", async () => {
      // Mock $runCommandRaw returning no results
      mockedPrisma.$runCommandRaw.mockResolvedValue({
        cursor: {
          firstBatch: [],
        },
      });

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
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "google",
        },
        passwordInfo: {
          hash: null,
          resetToken: null,
          resetExpires: null,
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
        emailInfo: {
          isVerified: false,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
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
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
        lockoutInfo: {
          isLocked: true,
          lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
          failedAttemptCount: 5,
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
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
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
      mockedPrisma.user.update.mockResolvedValue({} as any);

      await UserService.incrementFailedLoginAttempts(mockUser);

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          lockoutInfo: expect.objectContaining({
            failedAttemptCount: mockUser.lockoutInfo.failedAttemptCount + 1,
            isLocked: false,
          }),
        },
      });
    });

    it("should lock account when max attempts reached", async () => {
      const mockUser = createMockUser({
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 4,
        },
      });
      mockedPrisma.user.update.mockResolvedValue({} as any);

      await UserService.incrementFailedLoginAttempts(mockUser);

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          lockoutInfo: {
            isLocked: true,
            lockedUntil: expect.any(Date),
            failedAttemptCount: 5,
          },
        },
      });
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email for existing user", async () => {
      const mockUser = createMockUser();

      mockedPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockedPrisma.user.update.mockResolvedValue(mockUser);
      mockedEmailService.sendEmail.mockResolvedValue();

      await UserService.sendPasswordResetEmail(
        "john@example.com",
        "https://example.com/reset",
        "examaxis"
      );

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordInfo: {
            hash: mockUser.passwordInfo.hash,
            resetToken: expect.any(String),
            resetExpires: expect.any(Date),
          },
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
        emailInfo: {
          emailAddress: "john@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
        passwordInfo: {
          hash: "oldhashedpassword",
          resetToken: "hashed-reset-token",
          resetExpires: new Date(Date.now() + 3600000),
        },
      });

      mockedPrisma.$runCommandRaw.mockResolvedValue({
        cursor: {
          firstBatch: [
            {
              ...mockUser,
              _id: { $oid: mockUser.id },
            },
          ],
        },
      });
      mockedPrisma.user.update.mockResolvedValue({} as any);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashedpassword");

      await UserService.resetPasswordWithToken("reset-token", "newpassword123");

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "newpassword123"
      );
      expect(mockedPrisma.user.update).toHaveBeenCalled();
    });

    it("should unlock account when resetting password for locked account", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          emailAddress: "john@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
        passwordInfo: {
          hash: "oldhashedpassword",
          resetToken: "hashed-reset-token",
          resetExpires: new Date(Date.now() + 3600000),
        },
        lockoutInfo: {
          isLocked: true,
          lockedUntil: new Date(Date.now() + 3600000),
          failedAttemptCount: 5,
        },
      });

      mockedPrisma.$runCommandRaw.mockResolvedValue({
        cursor: {
          firstBatch: [
            {
              ...mockUser,
              _id: { $oid: mockUser.id },
            },
          ],
        },
      });
      mockedPrisma.user.update.mockResolvedValue({} as any);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashedpassword");

      await UserService.resetPasswordWithToken("reset-token", "newpassword123");

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          passwordInfo: expect.objectContaining({
            hash: "newhashedpassword",
          }),
          lockoutInfo: expect.objectContaining({
            isLocked: false,
          }),
        }),
      });
    });

    it("should verify email when resetting password for unverified account", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          emailAddress: "john@example.com",
          isVerified: false,
          verificationToken: "some-token",
          verificationExpires: new Date(Date.now() + 3600000),
          pendingEmail: null,
          provider: "local",
        },
        passwordInfo: {
          hash: "oldhashedpassword",
          resetToken: "hashed-reset-token",
          resetExpires: new Date(Date.now() + 3600000),
        },
      });

      mockedPrisma.$runCommandRaw.mockResolvedValue({
        cursor: {
          firstBatch: [
            {
              ...mockUser,
              _id: { $oid: mockUser.id },
            },
          ],
        },
      });
      mockedPrisma.user.update.mockResolvedValue({} as any);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashedpassword");

      await UserService.resetPasswordWithToken("reset-token", "newpassword123");

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          passwordInfo: expect.objectContaining({
            hash: "newhashedpassword",
          }),
          emailInfo: expect.objectContaining({
            isVerified: true,
          }),
        }),
      });
    });

    it("should throw error for invalid or expired token", async () => {
      mockedPrisma.$runCommandRaw.mockResolvedValue({
        cursor: {
          firstBatch: [],
        },
      });

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
        passwordInfo: {
          hash: "newhashed",
          resetToken: null,
          resetExpires: null,
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(null);
      mockedPrisma.user.update.mockResolvedValue(updatedUser);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashed");

      const result = await UserService.updateUserProfile(mockUser, {
        password: "newpassword123",
      });

      expect(mockedUserHelpers.hashPassword).toHaveBeenCalledWith(
        "newpassword123"
      );
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordInfo: {
            hash: "newhashed",
            resetToken: null,
            resetExpires: null,
          },
        },
      });
      expect(result).toEqual({
        user: updatedUser,
        message: "Password updated successfully",
      });
    });

    it("should update email and send verification", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          emailAddress: "old@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(null); // Email not taken
      mockedPrisma.user.update.mockResolvedValue(mockUser);
      mockedEmailService.sendEmail.mockResolvedValue();

      const result = await UserService.updateUserProfile(mockUser, {
        email: "new@example.com",
        redirectUrl: "https://example.com/verify",
      });

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          emailInfo: {
            ...mockUser.emailInfo,
            pendingEmail: "new@example.com",
            verificationToken: expect.any(String),
            verificationExpires: expect.any(Date),
          },
        },
      });
      expect(mockedEmailService.sendEmail).toHaveBeenCalledWith(
        "new@example.com",
        expect.objectContaining({
          subject: expect.any(String),
          html: expect.any(String),
          text: expect.any(String),
        })
      );
      expect(result).toEqual({
        user: mockUser,
        message:
          "Profile updated. Verification email sent to your new email address. Please verify to complete the email change.",
      });
    });

    it("should not send verification email if email is the same", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(null);
      mockedPrisma.user.update.mockResolvedValue(mockUser);

      const result = await UserService.updateUserProfile(mockUser, {
        email: "john@example.com",
      });

      expect(mockedEmailService.sendEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        user: mockUser,
        message: "Profile updated successfully",
      });
    });

    it("should reject duplicate email address", async () => {
      const mockUser = createMockUser();
      const existingUser = createMockUser({
        id: "other-user",
        email: "taken@example.com",
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(existingUser);

      await expect(
        UserService.updateUserProfile(mockUser, {
          email: "taken@example.com",
          redirectUrl: "https://example.com/verify",
        })
      ).rejects.toThrow("Email is already taken");
    });

    it("should rollback tempEmail if email sending fails", async () => {
      const mockUser = createMockUser({
        email: "old@example.com",
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(null);
      mockedPrisma.user.update.mockResolvedValueOnce(mockUser); // First update
      mockedPrisma.user.update.mockResolvedValueOnce(mockUser); // Rollback update
      mockedEmailService.sendEmail.mockRejectedValue(
        new Error("Email service error")
      );

      await expect(
        UserService.updateUserProfile(mockUser, {
          email: "new@example.com",
          redirectUrl: "https://example.com/verify",
        })
      ).rejects.toThrow("Email service error");

      // Verify rollback was called (second update call)
      expect(mockedPrisma.user.update).toHaveBeenCalledTimes(2);
    });

    it("should reject duplicate phone number", async () => {
      const mockUser = createMockUser();
      const existingUser = createMockUser({
        id: "other-user",
        phone: "+1234567890",
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(existingUser);

      await expect(
        UserService.updateUserProfile(mockUser, { phone: "+1234567890" })
      ).rejects.toThrow("Phone number is already taken");
    });

    it("should update multiple fields at once", async () => {
      const mockUser = createMockUser();
      const updatedUser = createMockUser({
        fullname: "Jane Smith",
        passwordInfo: {
          hash: "newhashed",
          resetToken: null,
          resetExpires: null,
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(null);
      mockedPrisma.user.update.mockResolvedValue(updatedUser);
      mockedUserHelpers.hashPassword.mockResolvedValue("newhashed");

      const result = await UserService.updateUserProfile(mockUser, {
        fullname: "Jane Smith",
        password: "newpass123",
      });

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          fullname: "Jane Smith",
          passwordInfo: {
            hash: "newhashed",
            resetToken: null,
            resetExpires: null,
          },
        },
      });
      expect(result).toEqual({
        user: updatedUser,
        message: "Password updated successfully",
      });
    });

    it("should reject email if it belongs to another user", async () => {
      const mockUser = createMockUser({ id: "user123" });
      const existingUser = createMockUser({
        id: "different-user",
        email: "taken@example.com",
        emailInfo: {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
      });

      mockedPrisma.user.findFirst.mockResolvedValue(existingUser);

      await expect(
        UserService.updateUserProfile(mockUser, { email: "taken@example.com" })
      ).rejects.toThrow("Email is already taken");
    });

    it("should handle empty updates gracefully", async () => {
      const mockUser = createMockUser();

      mockedPrisma.user.findFirst.mockResolvedValue(null);

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
