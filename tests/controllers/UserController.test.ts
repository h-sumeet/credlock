import * as UserController from "../../src/controllers/UserController";
import * as UserService from "../../src/services/UserService";
import * as SessionService from "../../src/services/SessionService";
import * as EmailValidation from "../../src/services/EmailValidation";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("../../src/services/UserService");
jest.mock("../../src/services/SessionService");
jest.mock("../../src/services/EmailValidation");
jest.mock("../../src/helpers/logger");

const mockedUserService = UserService as jest.Mocked<typeof UserService>;
const mockedSessionService = SessionService as jest.Mocked<
  typeof SessionService
>;
const mockedEmailValidation = EmailValidation as jest.Mocked<
  typeof EmailValidation
>;

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

// Mock Express objects
const createMockRequest = (overrides: Partial<any> = {}): any => ({
  body: {},
  headers: {},
  user: undefined,
  serviceId: "examaxis",
  deviceId: "device-123",
  userId: "550e8400-e29b-41d4-a716-446655440000",
  ip: "127.0.0.1",
  socket: { remoteAddress: "127.0.0.1" },
  ...overrides,
});

const createMockResponse = (): any => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const createMockNext = (): jest.Mock => jest.fn();

describe("UserController", () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockNext = createMockNext();

    // Default mock: non-disposable email
    mockedEmailValidation.isDisposableEmail.mockResolvedValue(false);
  });

  describe("register", () => {
    it("should register user successfully", async () => {
      mockRequest.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "Password123!",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.createUserWithVerification.mockResolvedValue({
        message:
          "User registered successfully. Please check your email for verification.",
      });

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockedEmailValidation.isDisposableEmail).toHaveBeenCalledWith(
        "john@example.com"
      );
      expect(mockedUserService.createUserWithVerification).toHaveBeenCalledWith(
        "John Doe",
        "john@example.com",
        undefined,
        "Password123!",
        "examaxis",
        "https://example.com/verify"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "User registered successfully. Please check your email for verification.",
        data: undefined,
      });
    });

    it("should register user with phone number", async () => {
      mockRequest.body = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        password: "Password123!",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.createUserWithVerification.mockResolvedValue({
        message:
          "User registered successfully. Please check your email for verification.",
      });

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.createUserWithVerification).toHaveBeenCalledWith(
        "John Doe",
        "john@example.com",
        "+1234567890",
        "Password123!",
        "examaxis",
        "https://example.com/verify"
      );
    });

    it("should reject disposable email addresses", async () => {
      mockRequest.body = {
        name: "John Doe",
        email: "john@tempmail.com",
        password: "Password123!",
        redirectUrl: "https://example.com/verify",
      };

      mockedEmailValidation.isDisposableEmail.mockResolvedValue(true);

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Please use a valid email address",
        })
      );
      expect(
        mockedUserService.createUserWithVerification
      ).not.toHaveBeenCalled();
    });

    it("should handle registration errors", async () => {
      mockRequest.body = {
        name: "John Doe",
        email: "existing@example.com",
        password: "Password123!",
        redirectUrl: "https://example.com/verify",
      };

      const error = new Error("User with this email already exists");
      mockedUserService.createUserWithVerification.mockRejectedValue(error);

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      const mockUser = createMockUser();
      const mockTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: "15m",
      };

      mockRequest.body = { token: "verification-token" };
      mockRequest.headers = { "user-agent": "test-agent" };

      mockedUserService.verifyEmailWithToken.mockResolvedValue({
        user: mockUser,
      });
      mockedSessionService.generateTokenPair.mockResolvedValue(mockTokens);

      await UserController.verifyEmail(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.verifyEmailWithToken).toHaveBeenCalledWith(
        "verification-token"
      );
      expect(mockedSessionService.generateTokenPair).toHaveBeenCalledWith(
        mockUser,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Email verified successfully",
        data: expect.objectContaining({
          user: expect.any(Object),
          tokens: mockTokens,
        }),
      });
    });

    it("should throw error when deviceId is missing", async () => {
      mockRequest.body = { token: "verification-token" };
      mockRequest.deviceId = undefined;

      await UserController.verifyEmail(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "DeviceId header is required",
        })
      );
    });

    it("should handle verification errors", async () => {
      mockRequest.body = { token: "invalid-token" };

      const error = new Error("Invalid or expired email verification token");
      mockedUserService.verifyEmailWithToken.mockRejectedValue(error);

      await UserController.verifyEmail(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const mockUser = createMockUser();
      const mockTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: "15m",
      };

      mockRequest.body = {
        email: "john@example.com",
        password: "Password123!",
      };
      mockRequest.headers = { "user-agent": "test-agent" };

      mockedUserService.authenticateUser.mockResolvedValue({ user: mockUser });
      mockedSessionService.generateTokenPair.mockResolvedValue(mockTokens);

      await UserController.login(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.authenticateUser).toHaveBeenCalledWith(
        "john@example.com",
        "Password123!",
        "examaxis"
      );
      expect(mockedSessionService.generateTokenPair).toHaveBeenCalledWith(
        mockUser,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Login successful",
        data: expect.objectContaining({
          user: expect.any(Object),
          tokens: mockTokens,
        }),
      });
    });

    it("should throw error when deviceId is missing", async () => {
      mockRequest.body = {
        email: "john@example.com",
        password: "Password123!",
      };
      mockRequest.deviceId = undefined;

      await UserController.login(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "DeviceId header is required",
        })
      );
    });

    it("should handle invalid credentials", async () => {
      mockRequest.body = {
        email: "john@example.com",
        password: "wrongpassword",
      };

      const error = new Error("Invalid email or password!");
      mockedUserService.authenticateUser.mockRejectedValue(error);

      await UserController.login(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("refreshToken", () => {
    it("should refresh token successfully", async () => {
      const mockTokens = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: "15m",
      };

      mockRequest.headers = {
        "x-refresh-token": "old-refresh-token",
        "user-agent": "test-agent",
      };

      mockedSessionService.refreshAccessToken.mockResolvedValue(mockTokens);

      await UserController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.refreshAccessToken).toHaveBeenCalledWith(
        "old-refresh-token",
        "device-123",
        "test-agent",
        "127.0.0.1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Token refreshed successfully",
        data: { tokens: mockTokens },
      });
    });

    it("should handle refresh token errors", async () => {
      mockRequest.headers = { "x-refresh-token": "invalid-token" };

      const error = new Error("Invalid or expired refresh token");
      mockedSessionService.refreshAccessToken.mockRejectedValue(error);

      await UserController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("forgotPassword", () => {
    it("should send password reset email successfully", async () => {
      mockRequest.body = {
        email: "john@example.com",
        redirectUrl: "https://example.com/reset",
      };

      mockedUserService.sendPasswordResetEmail.mockResolvedValue();

      await UserController.forgotPassword(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.sendPasswordResetEmail).toHaveBeenCalledWith(
        "john@example.com",
        "https://example.com/reset",
        "examaxis"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "If an account with that email exists, a password reset link has been sent",
        data: undefined,
      });
    });

    it("should handle forgot password errors", async () => {
      mockRequest.body = {
        email: "nonexistent@example.com",
        redirectUrl: "https://example.com/reset",
      };

      const error = new Error("Don't have an account with that email");
      mockedUserService.sendPasswordResetEmail.mockRejectedValue(error);

      await UserController.forgotPassword(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      mockRequest.body = {
        token: "reset-token",
        password: "NewPassword123!",
      };

      mockedUserService.resetPasswordWithToken.mockResolvedValue();

      await UserController.resetPassword(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.resetPasswordWithToken).toHaveBeenCalledWith(
        "reset-token",
        "NewPassword123!"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Password reset successful. Please login with your new password.",
        data: undefined,
      });
    });

    it("should handle reset password errors", async () => {
      mockRequest.body = {
        token: "invalid-token",
        password: "NewPassword123!",
      };

      const error = new Error("Invalid or expired password reset token");
      mockedUserService.resetPasswordWithToken.mockRejectedValue(error);

      await UserController.resetPassword(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("getProfile", () => {
    it("should return user profile successfully", async () => {
      const mockUser = createMockUser();

      mockedUserService.getUserById.mockResolvedValue(mockUser);

      await UserController.getProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.getUserById).toHaveBeenCalledWith(
        mockRequest.userId
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Profile retrieved successfully",
        data: expect.objectContaining({
          user: expect.any(Object),
        }),
      });
    });

    it("should handle profile retrieval errors", async () => {
      const error = new Error("User not found");
      mockedUserService.getUserById.mockRejectedValue(error);

      await UserController.getProfile(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("updateProfile", () => {
    it("should update profile successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser, name: "Jane Doe" };

      mockRequest.body = { name: "Jane Doe" };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: updatedUser,
        message: "Profile updated successfully",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.updateUserProfile).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.body
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Profile updated successfully",
        data: expect.objectContaining({
          user: expect.any(Object),
        }),
      });
    });

    it("should update password and prompt re-login", async () => {
      const mockUser = createMockUser();

      mockRequest.body = { password: "NewPassword123!" };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: mockUser,
        message:
          "Profile updated successfully. Please login again with your new password.",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Profile updated successfully. Please login again with your new password.",
        data: expect.any(Object),
      });
    });

    it("should handle profile update errors", async () => {
      mockRequest.body = { name: "Jane Doe" };

      const error = new Error("Profile update failed");
      mockedUserService.updateUserProfile.mockRejectedValue(error);

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("updateEmail", () => {
    it("should update email successfully", async () => {
      mockRequest.body = {
        email: "newemail@example.com",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.updateEmailWithVerification.mockResolvedValue({
        message: "Verification email sent to new email address",
      });

      await UserController.updateEmail(mockRequest, mockResponse, mockNext);

      expect(mockedEmailValidation.isDisposableEmail).toHaveBeenCalledWith(
        "newemail@example.com"
      );
      expect(
        mockedUserService.updateEmailWithVerification
      ).toHaveBeenCalledWith(
        mockRequest.userId,
        "examaxis",
        "newemail@example.com",
        "https://example.com/verify"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Verification email sent to new email address",
        data: undefined,
      });
    });

    it("should reject disposable email for email update", async () => {
      mockRequest.body = {
        email: "temp@tempmail.com",
        redirectUrl: "https://example.com/verify",
      };

      mockedEmailValidation.isDisposableEmail.mockResolvedValue(true);

      await UserController.updateEmail(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Please use a valid email address",
        })
      );
      expect(
        mockedUserService.updateEmailWithVerification
      ).not.toHaveBeenCalled();
    });

    it("should handle email update errors", async () => {
      mockRequest.body = {
        email: "taken@example.com",
        redirectUrl: "https://example.com/verify",
      };

      const error = new Error("Email already in use");
      mockedUserService.updateEmailWithVerification.mockRejectedValue(error);

      await UserController.updateEmail(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("logout", () => {
    it("should logout user with deviceId", async () => {
      mockedSessionService.revokeUserSession.mockResolvedValue();

      await UserController.logout(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.revokeUserSession).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.deviceId
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Logout successful",
        data: undefined,
      });
    });

    it("should logout from all sessions when deviceId is missing", async () => {
      mockRequest.deviceId = undefined;

      mockedSessionService.revokeAllUserSessions.mockResolvedValue();

      await UserController.logout(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockRequest.userId
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Logout successful",
        data: undefined,
      });
    });

    it("should handle logout errors", async () => {
      const error = new Error("Session revocation failed");
      mockedSessionService.revokeUserSession.mockRejectedValue(error);

      await UserController.logout(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("logoutAll", () => {
    it("should logout from all devices successfully", async () => {
      mockedSessionService.revokeAllUserSessions.mockResolvedValue();

      await UserController.logoutAll(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockRequest.userId
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Logged out from all devices successfully",
        data: undefined,
      });
    });

    it("should handle logout all errors", async () => {
      const error = new Error("Failed to revoke all sessions");
      mockedSessionService.revokeAllUserSessions.mockRejectedValue(error);

      await UserController.logoutAll(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteAccount", () => {
    it("should delete account successfully", async () => {
      mockedUserService.archiveUserAccount.mockResolvedValue({
        message: "Account deleted successfully",
      });

      await UserController.deleteAccount(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.archiveUserAccount).toHaveBeenCalledWith(
        mockRequest.userId
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Account deleted successfully",
        data: undefined,
      });
    });

    it("should handle account deletion errors", async () => {
      const error = new Error("Failed to delete account");
      mockedUserService.archiveUserAccount.mockRejectedValue(error);

      await UserController.deleteAccount(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
