import * as UserController from "../../src/controllers/UserController";
import * as UserService from "../../src/services/UserService";
import * as SessionService from "../../src/services/SessionService";
import * as EmailValidation from "../../src/services/EmailValidation";

// Mock dependencies
jest.mock("../../src/services/UserService");
jest.mock("../../src/services/SessionService");
jest.mock("../../src/services/EmailValidation");

const mockedUserService = UserService as jest.Mocked<typeof UserService>;
const mockedSessionService = SessionService as jest.Mocked<
  typeof SessionService
>;
const mockedEmailValidation = EmailValidation as jest.Mocked<
  typeof EmailValidation
>;

// Helper function to create clean mock user objects (Prisma format)
const createMockUser = (overrides: Partial<any> = {}): any => {
  const defaultUser = {
    id: "507f1f77bcf86cd799439011",
    fullname: "John Doe",
    email: "john@example.com",
    phone: undefined,
    service: "examaxis",
    emailInfo: {
      isVerified: false,
      verificationToken: undefined,
      verificationExpires: undefined,
      pendingEmail: undefined,
      provider: "local",
    },
    phoneInfo: undefined,
    passwordInfo: {
      hash: "hashedpassword",
      resetToken: undefined,
      resetExpires: undefined,
    },
    lockoutInfo: {
      isLocked: false,
      lockedUntil: undefined,
      failedAttemptCount: 0,
    },
    isActive: true,
    lastLoginAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...defaultUser, ...overrides };
};

// Helper to get the serialized version (what the API returns)
const getSerializedUser = (user: any) => {
  return {
    id: user.id,
    fullname: user.fullname,
    ...(user.profileImage && {
      profileImage: user.profileImage,
    }),
    email: user.email,
    email_verified: user.emailInfo?.isVerified ?? false,
    ...(user.emailInfo?.provider && {
      email_provider: user.emailInfo.provider,
    }),
    ...(user.phone && {
      phone: user.phone,
      phone_verified: user.phoneInfo?.isVerified ?? false,
    }),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// Mock Express objects
const createMockRequest = (overrides: Partial<any> = {}): any => ({
  body: {},
  headers: {},
  user: undefined,
  service: "examaxis",
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

    // Mock isDisposableEmail to return false by default
    mockedEmailValidation.isDisposableEmail.mockResolvedValue(false);
  });

  describe("register", () => {
    it("should register user successfully", async () => {
      const mockUser = createMockUser();
      const mockVerificationToken = "verification-token-123";

      mockRequest.body = {
        fullname: "John Doe",
        email: "john@example.com",
        password: "password123",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.checkUserExists.mockResolvedValue({ exists: false });
      mockedUserService.createUserWithVerification.mockResolvedValue({
        user: mockUser,
        verificationToken: mockVerificationToken,
      });
      mockedUserService.sendEmailVerification.mockResolvedValue();

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.checkUserExists).toHaveBeenCalledWith(
        "john@example.com",
        undefined,
        "examaxis"
      );
      expect(mockedUserService.createUserWithVerification).toHaveBeenCalledWith(
        "John Doe",
        "john@example.com",
        undefined,
        "password123",
        "examaxis"
      );
      expect(mockedUserService.sendEmailVerification).toHaveBeenCalledWith(
        "john@example.com",
        "John Doe",
        mockVerificationToken,
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
      const mockUser = createMockUser();
      const mockVerificationToken = "verification-token-123";

      mockRequest.body = {
        fullname: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        password: "password123",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.checkUserExists.mockResolvedValue({ exists: false });
      mockedUserService.createUserWithVerification.mockResolvedValue({
        user: mockUser,
        verificationToken: mockVerificationToken,
      });
      mockedUserService.sendEmailVerification.mockResolvedValue();

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.checkUserExists).toHaveBeenCalledWith(
        "john@example.com",
        "+1234567890",
        "examaxis"
      );
      expect(mockedUserService.createUserWithVerification).toHaveBeenCalledWith(
        "John Doe",
        "john@example.com",
        "+1234567890",
        "password123",
        "examaxis"
      );
    });

    it("should register user with custom fields", async () => {
      const mockUser = createMockUser();
      const mockVerificationToken = "verification-token-123";

      mockRequest.body = {
        fullname: "John Doe",
        email: "john@example.com",
        password: "password123",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.checkUserExists.mockResolvedValue({ exists: false });
      mockedUserService.createUserWithVerification.mockResolvedValue({
        user: mockUser,
        verificationToken: mockVerificationToken,
      });
      mockedUserService.sendEmailVerification.mockResolvedValue();

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.createUserWithVerification).toHaveBeenCalledWith(
        "John Doe",
        "john@example.com",
        undefined,
        "password123",
        "examaxis"
      );
    });

    it("should return error when email already exists", async () => {
      mockRequest.body = {
        fullname: "John Doe",
        email: "existing@example.com",
        password: "password123",
      };

      const mockUser = createMockUser({
        email: "existing@example.com",
        emailInfo: {
          isVerified: true,
          verificationToken: undefined,
          verificationExpires: undefined,
          pendingEmail: undefined,
          provider: "local",
        },
      });
      mockedUserService.checkUserExists.mockResolvedValue({
        exists: true,
        user: mockUser,
        field: "email",
      });

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User with this email already exists",
        })
      );
    });

    it("should return error when phone already exists", async () => {
      mockRequest.body = {
        fullname: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        password: "password123",
      };

      const mockUser = createMockUser({
        phone: "+1234567890",
        emailInfo: {
          isVerified: true,
          verificationToken: undefined,
          verificationExpires: undefined,
          pendingEmail: undefined,
          provider: "local",
        },
      });
      mockedUserService.checkUserExists.mockResolvedValue({
        exists: true,
        user: mockUser,
        field: "phone",
      });

      await UserController.register(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User with this phone number already exists",
        })
      );
    });

    it("should continue registration even if email sending fails", async () => {
      const mockUser = createMockUser();
      const mockVerificationToken = "verification-token-123";

      mockRequest.body = {
        fullname: "John Doe",
        email: "john@example.com",
        password: "password123",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.checkUserExists.mockResolvedValue({ exists: false });
      mockedUserService.createUserWithVerification.mockResolvedValue({
        user: mockUser,
        verificationToken: mockVerificationToken,
      });
      mockedUserService.sendEmailVerification.mockRejectedValue(
        new Error("Email service error")
      );

      await UserController.register(mockRequest, mockResponse, mockNext);

      // Should still return success even if email fails
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "User registered successfully. Please check your email for verification.",
        data: undefined,
      });
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully for new user", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          address: "john@example.com",
          isVerified: true,
          verificationToken: undefined,
          verificationExpires: undefined,
        },
      });
      const mockTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: "15m",
      };

      mockRequest.body = { token: "verification-token" };
      mockRequest.headers = { "user-agent": "test-agent" };

      mockedUserService.verifyEmailWithToken.mockResolvedValue({
        user: mockUser,
        isNewlyVerified: true,
      });
      mockedSessionService.generateTokenPair.mockResolvedValue(mockTokens);

      await UserController.verifyEmail(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.verifyEmailWithToken).toHaveBeenCalledWith(
        "verification-token"
      );
      expect(mockedSessionService.generateTokenPair).toHaveBeenCalledWith(
        mockUser,
        "test-agent",
        "127.0.0.1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Email verified successfully",
        data: {
          user: getSerializedUser(mockUser),
          tokens: mockTokens,
        },
      });
    });

    it("should verify email for already verified user without generating tokens", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          address: "john@example.com",
          isVerified: true,
          verificationToken: undefined,
          verificationExpires: undefined,
        },
      });

      mockRequest.body = { token: "verification-token" };

      mockedUserService.verifyEmailWithToken.mockResolvedValue({
        user: mockUser,
        isNewlyVerified: false,
      });

      await UserController.verifyEmail(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.verifyEmailWithToken).toHaveBeenCalledWith(
        "verification-token"
      );
      expect(mockedSessionService.generateTokenPair).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Email verified successfully",
        data: {
          user: getSerializedUser(mockUser),
          tokens: null,
        },
      });
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const mockUser = createMockUser({
        emailInfo: {
          address: "john@example.com",
          isVerified: true,
          verificationToken: undefined,
          verificationExpires: undefined,
        },
      });
      const mockTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: "15m",
      };

      mockRequest.body = {
        email: "john@example.com",
        password: "password123",
      };
      mockRequest.headers = { "user-agent": "test-agent" };

      mockedUserService.authenticateUser.mockResolvedValue({
        user: mockUser,
        isValid: true,
      });
      mockedSessionService.generateTokenPair.mockResolvedValue(mockTokens);

      await UserController.login(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.authenticateUser).toHaveBeenCalledWith(
        "john@example.com",
        "password123",
        "examaxis"
      );
      expect(mockedSessionService.generateTokenPair).toHaveBeenCalledWith(
        mockUser,
        "test-agent",
        "127.0.0.1"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Login successful",
        data: {
          user: getSerializedUser(mockUser),
          tokens: mockTokens,
        },
      });
    });

    it("should return error for invalid credentials", async () => {
      mockRequest.body = {
        email: "john@example.com",
        password: "wrongpassword",
      };

      mockedUserService.authenticateUser.mockResolvedValue({
        user: createMockUser(),
        isValid: false,
      });

      await UserController.login(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid email or password!",
        })
      );
    });
  });

  describe("refreshToken", () => {
    it("should refresh access token successfully", async () => {
      const mockTokens = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: "15m",
      };

      mockRequest.headers = { "x-refresh-token": "old-refresh-token" };

      mockedSessionService.refreshAccessToken.mockResolvedValue(mockTokens);

      await UserController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.refreshAccessToken).toHaveBeenCalledWith(
        "old-refresh-token"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Token refreshed successfully",
        data: { tokens: mockTokens },
      });
    });
  });

  describe("getProfile", () => {
    it("should return user profile", async () => {
      const mockUser = createMockUser();

      mockRequest.user = mockUser;

      await UserController.getProfile(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Profile retrieved successfully",
        data: { user: getSerializedUser(mockUser) },
      });
    });
  });

  describe("updateProfile", () => {
    it("should update fullname successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser, fullname: "Jane Doe" };

      mockRequest.user = mockUser;
      mockRequest.body = { fullname: "Jane Doe" };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: updatedUser,
        message: "Profile updated successfully",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.updateUserProfile).toHaveBeenCalledWith(
        mockUser,
        {
          fullname: "Jane Doe",
          email: undefined,
          phone: undefined,
          password: undefined,
          redirectUrl: undefined,
        }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Profile updated successfully",
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: mockUser.id,
            fullname: "Jane Doe",
          }),
        }),
      });
    });

    it("should update email and send verification", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser };

      mockRequest.user = mockUser;
      mockRequest.body = {
        email: "newemail@example.com",
        redirectUrl: "https://example.com/verify",
      };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: updatedUser,
        message:
          "Profile updated. Verification email sent to your new email address. Please verify to complete the email change.",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.updateUserProfile).toHaveBeenCalledWith(
        mockUser,
        {
          fullname: undefined,
          email: "newemail@example.com",
          phone: undefined,
          password: undefined,
          redirectUrl: "https://example.com/verify",
        }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Profile updated. Verification email sent to your new email address. Please verify to complete the email change.",
        data: expect.objectContaining({
          user: expect.any(Object),
        }),
      });
    });

    it("should update phone successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser };

      mockRequest.user = mockUser;
      mockRequest.body = { phone: "+1234567890" };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: updatedUser,
        message: "Profile updated successfully",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.updateUserProfile).toHaveBeenCalledWith(
        mockUser,
        {
          fullname: undefined,
          email: undefined,
          phone: "+1234567890",
          password: undefined,
          redirectUrl: undefined,
        }
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

    it("should update password successfully", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser };

      mockRequest.user = mockUser;
      mockRequest.body = { password: "newpassword123" };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: updatedUser,
        message: "Profile updated successfully",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.updateUserProfile).toHaveBeenCalledWith(
        mockUser,
        {
          fullname: undefined,
          email: undefined,
          phone: undefined,
          password: "newpassword123",
          redirectUrl: undefined,
        }
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

    it("should update multiple fields at once", async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser };

      mockRequest.user = mockUser;
      mockRequest.body = {
        fullname: "Jane Smith",
        phone: "+9876543210",
      };

      mockedUserService.updateUserProfile.mockResolvedValue({
        user: updatedUser,
        message: "Profile updated successfully",
      });

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.updateUserProfile).toHaveBeenCalledWith(
        mockUser,
        {
          fullname: "Jane Smith",
          email: undefined,
          phone: "+9876543210",
          password: undefined,
          redirectUrl: undefined,
        }
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

    it("should handle errors during profile update", async () => {
      const mockUser = createMockUser();

      mockRequest.user = mockUser;
      mockRequest.body = { email: "taken@example.com" };

      const error = new Error("Email address is already in use");
      mockedUserService.updateUserProfile.mockRejectedValue(error);

      await UserController.updateProfile(mockRequest, mockResponse, mockNext);

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
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      mockRequest.body = {
        token: "reset-token",
        password: "newpassword123",
      };

      mockedUserService.resetPasswordWithToken.mockResolvedValue();

      await UserController.resetPassword(mockRequest, mockResponse, mockNext);

      expect(mockedUserService.resetPasswordWithToken).toHaveBeenCalledWith(
        "reset-token",
        "newpassword123"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Password reset successful. Please login with your new password.",
        data: undefined,
      });
    });
  });

  describe("logout", () => {
    it("should logout user with refresh token", async () => {
      const mockUser = createMockUser();

      mockRequest.user = mockUser;
      mockRequest.headers = { "x-refresh-token": "refresh-token" };

      mockedSessionService.revokeRefreshToken.mockResolvedValue();

      await UserController.logout(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.revokeRefreshToken).toHaveBeenCalledWith(
        "refresh-token"
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Logout successful",
        data: undefined,
      });
    });

    it("should logout user without refresh token by revoking all sessions", async () => {
      const mockUser = createMockUser();

      mockRequest.user = mockUser;
      mockRequest.headers = {};

      mockedSessionService.revokeAllUserSessions.mockResolvedValue();

      await UserController.logout(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUser.id
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Logout successful",
        data: undefined,
      });
    });

    it("should handle logout errors", async () => {
      const mockUser = createMockUser();
      const error = new Error("Session revocation failed");

      mockRequest.user = mockUser;
      mockRequest.headers = { "x-refresh-token": "refresh-token" };

      mockedSessionService.revokeRefreshToken.mockRejectedValue(error);

      await UserController.logout(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("logoutAll", () => {
    it("should logout user from all devices successfully", async () => {
      const mockUser = createMockUser();

      mockRequest.user = mockUser;

      mockedSessionService.revokeAllUserSessions.mockResolvedValue();

      await UserController.logoutAll(mockRequest, mockResponse, mockNext);

      expect(mockedSessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUser.id
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "success",
        code: 200,
        msg: "Logged out from all devices successfully",
        data: undefined,
      });
    });
  });
});
