import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../../src/middleware/auth";
import * as JwtHelper from "../../src/helpers/jwt";
import type { IJWTPayload } from "../../src/types/auth";
import { prisma } from "../../src/config/prisma";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    session: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("../../src/helpers/jwt");

const mockedJwtHelper = JwtHelper as jest.Mocked<typeof JwtHelper>;
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe("Authentication Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("authenticate", () => {
    it("should authenticate valid bearer token successfully", async () => {
      const mockUser = {
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
          is_verified: true,
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

      const mockPayload: IJWTPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
        service: "examaxis",
      };

      const refreshToken = "valid-refresh-token";
      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "session123",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        refresh_token: "hashed-token",
        expires_at: new Date(Date.now() + 86400000),
      } as any);

      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": refreshToken,
      };

      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);
      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser as any
      );

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwtHelper.verifyAccessToken).toHaveBeenCalledWith(
        "valid-token"
      );
      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          service: "examaxis",
        },
        include: expect.any(Object),
      });
      expect(mockRequest.user).toBe(mockUser);
      expect(mockRequest.jwt).toBe(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should reject request without authorization header", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": "valid-refresh-token",
        "x-service": "examaxis",
      };

      mockedJwtHelper.verifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token",
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should reject request with invalid authorization format", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": "valid-refresh-token",
        "x-service": "examaxis",
      };

      mockedJwtHelper.verifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token",
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should reject request with only 'Bearer' prefix", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": "valid-refresh-token",
        "x-service": "examaxis",
      };

      mockedJwtHelper.verifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token",
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should reject invalid JWT token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
        "x-refresh-token": "refresh-token",
        "x-service": "examaxis",
      };

      mockedJwtHelper.verifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token",
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should reject when user is not found", async () => {
      const mockPayload: IJWTPayload = {
        userId: "user123",
        email: "test@example.com",
        service: "examaxis",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": "valid-refresh-token",
      };

      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "session123",
        isActive: true,
      } as any);
      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);
      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not found",
          code: 401,
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should reject when user account is locked", async () => {
      const mockUser = {
        id: "user123",
        fullName: "John Doe",
        emailInfo: {
          emailAddress: "test@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
          created_at: new Date(),
          updated_at: new Date(),
        },
        phone_info: null,
        password_info: {
          id: "password-info-id",
          user_id: "user123",
          hash: "hashedPassword123",
          reset_token: null,
          reset_expires: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        lockout_info: {
          id: "lockout-info-id",
          user_id: "user123",
          is_locked: true,
          locked_until: new Date(Date.now() + 3600000), // 1 hour from now
          failed_attempt_count: 5,
          created_at: new Date(),
          updated_at: new Date(),
        },
        is_active: true,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockPayload: IJWTPayload = {
        userId: "user123",
        email: "test@example.com",
        service: "examaxis",
      };

      const refreshToken = "valid-refresh-token";
      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "session123",
        isActive: true,
      } as any);

      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": refreshToken,
      };

      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);
      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser as any
      );

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Account is locked due to multiple failed login attempts",
          code: 423,
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const mockPayload: IJWTPayload = {
        userId: "user123",
        email: "test@example.com",
        service: "examaxis",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
        "x-refresh-token": "valid-refresh-token",
      };

      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "session123",
        isActive: true,
      } as any);
      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);
      (mockedPrisma.user.findFirst as jest.Mock).mockRejectedValue(
        new Error("Database connection error")
      );

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Database connection error",
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should extract token correctly from bearer with extra spaces", async () => {
      const mockUser = {
        id: "user123",
        fullName: "John Doe",
        emailInfo: {
          emailAddress: "test@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "local",
        },
        phoneInfo: null,
        passwordInfo: {
          hash: "hashedPassword123",
          resetToken: null,
          resetExpires: null,
        },
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
        },
        customFields: {},
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPayload: IJWTPayload = {
        userId: "user123",
        email: "test@example.com",
        service: "examaxis",
      };

      const refreshToken = "valid-refresh-token";
      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "session123",
        isActive: true,
      } as any);

      mockRequest.headers = {
        authorization: "Bearer   valid-token-with-spaces   ",
        "x-refresh-token": refreshToken,
        "x-service": "examaxis",
      };

      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);
      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser as any
      );

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwtHelper.verifyAccessToken).toHaveBeenCalledWith(
        "valid-token-with-spaces"
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
