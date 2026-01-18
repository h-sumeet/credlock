import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import {
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  exchangeCode,
} from "../../src/controllers/OauthController";
import { generateTokenPair } from "../../src/services/SessionService";
import { generateRandomString } from "../../src/utils/crypto";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("passport");
jest.mock("../../src/services/SessionService");
jest.mock("../../src/utils/crypto");
jest.mock("../../src/helpers/logger");

// Mock timers to prevent hanging
jest.useFakeTimers();

const mockPassport = passport as jest.Mocked<typeof passport>;
const mockGenerateTokenPair = generateTokenPair as jest.MockedFunction<
  typeof generateTokenPair
>;
const mockGenerateRandomString = generateRandomString as jest.MockedFunction<
  typeof generateRandomString
>;

describe("OauthController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const createMockUser = (): User => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test User",
    email: "test@example.com",
    phone: null,
    serviceId: "examaxis",
    avatar: null,
    provider: "google",
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockReq = {
      query: {
        redirectUrl: "http://localhost:3000/callback",
        serviceId: "examaxis",
        deviceId: "device-123",
        state: JSON.stringify({
          redirectUrl: "http://localhost:3000/callback",
          serviceId: "examaxis",
          deviceId: "device-123",
        }),
      },
      headers: { "user-agent": "test-agent" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" } as any,
      user: createMockUser(),
    };

    mockRes = {
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
    jest.clearAllMocks();

    mockGenerateTokenPair.mockResolvedValue({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresIn: "15m",
    });

    mockGenerateRandomString.mockReturnValue("mock-random-code");
    mockPassport.authenticate.mockImplementation(() =>
      jest.fn((req, res, next) => next())
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe("googleAuth", () => {
    it("should initiate Google OAuth with correct parameters", async () => {
      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPassport.authenticate).toHaveBeenCalledWith(
        "google-examaxis",
        {
          scope: ["profile", "email"],
          accessType: "offline",
          prompt: "select_account",
          state: expect.any(String),
        }
      );
    });

    it("should throw error when redirectUrl is missing", async () => {
      mockReq.query = { serviceId: "examaxis", deviceId: "device-123" };

      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing redirectUrl",
        })
      );
    });

    it("should throw error when serviceId is missing", async () => {
      mockReq.query = {
        redirectUrl: "http://localhost:3000/callback",
        deviceId: "device-123",
      };

      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing service Id parameter",
        })
      );
    });

    it("should throw error when deviceId is missing", async () => {
      mockReq.query = {
        redirectUrl: "http://localhost:3000/callback",
        serviceId: "examaxis",
      };

      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing device Id parameter",
        })
      );
    });

    it("should throw error for invalid service", async () => {
      mockReq.query = {
        redirectUrl: "http://localhost:3000/callback",
        serviceId: "invalid-service",
        deviceId: "device-123",
      };

      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid service.",
        })
      );
    });

    it("should include nextUrl in state when provided", async () => {
      mockReq.query = {
        redirectUrl: "http://localhost:3000/callback",
        nextUrl: "http://localhost:3000/dashboard",
        serviceId: "examaxis",
        deviceId: "device-123",
      };

      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      const authenticateCall = mockPassport.authenticate.mock.calls[0];
      expect(authenticateCall).toBeDefined();
      const options = authenticateCall![1] as { state: string };
      const stateObj = JSON.parse(options.state);
      expect(stateObj.nextUrl).toBe("http://localhost:3000/dashboard");
    });
  });

  describe("googleCallback", () => {
    it("should generate tokens and redirect with login code", async () => {
      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockGenerateTokenPair).toHaveBeenCalledWith(
        mockReq.user,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining("code=mock-random-code")
      );
    });

    it("should throw error when user is not authenticated", async () => {
      mockReq.user = undefined;

      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not authenticated",
        })
      );
    });

    it("should throw error when state parameter is missing", async () => {
      mockReq.query = {};
      mockReq.user = createMockUser();

      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing state parameter",
        })
      );
    });

    it("should handle token generation errors", async () => {
      const error = new Error("Token generation failed");
      mockGenerateTokenPair.mockRejectedValue(error);

      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it("should include nextUrl in redirect if provided", async () => {
      mockReq.query = {
        ...mockReq.query,
        state: JSON.stringify({
          redirectUrl: "http://localhost:3000/callback",
          nextUrl: "http://localhost:3000/dashboard",
          deviceId: "device-123",
        }),
      };

      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining(
          "redirectUrl=http%3A%2F%2Flocalhost%3A3000%2Fdashboard"
        )
      );
    });

    it("should use socket remoteAddress when ip is not available", async () => {
      // Create a new request object without ip property
      const reqWithoutIp = {
        ...mockReq,
        ip: undefined as string | undefined,
      } as Request;

      await googleCallback(reqWithoutIp, mockRes as Response, mockNext);

      expect(mockGenerateTokenPair).toHaveBeenCalledWith(
        mockReq.user,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );
    });
  });

  describe("githubAuth", () => {
    it("should initiate GitHub OAuth with correct parameters", async () => {
      await githubAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPassport.authenticate).toHaveBeenCalledWith(
        "github-examaxis",
        {
          scope: ["user:email"],
          state: expect.any(String),
        }
      );
    });

    it("should throw error when redirectUrl is missing", async () => {
      mockReq.query = { serviceId: "examaxis", deviceId: "device-123" };

      await githubAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing redirectUrl",
        })
      );
    });

    it("should throw error when serviceId is missing", async () => {
      mockReq.query = {
        redirectUrl: "http://localhost:3000/callback",
        deviceId: "device-123",
      };

      await githubAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing service Id parameter",
        })
      );
    });

    it("should throw error when deviceId is missing", async () => {
      mockReq.query = {
        redirectUrl: "http://localhost:3000/callback",
        serviceId: "examaxis",
      };

      await githubAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing device Id parameter",
        })
      );
    });
  });

  describe("githubCallback", () => {
    it("should generate tokens and redirect with login code", async () => {
      await githubCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockGenerateTokenPair).toHaveBeenCalledWith(
        mockReq.user,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining("code=mock-random-code")
      );
    });

    it("should throw error when user is not authenticated", async () => {
      mockReq.user = undefined;

      await githubCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not authenticated",
        })
      );
    });

    it("should handle token generation errors", async () => {
      const error = new Error("Token generation failed");
      mockGenerateTokenPair.mockRejectedValue(error);

      await githubCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("exchangeCode", () => {
    it("should throw error for missing code", () => {
      mockReq.query = {};

      expect(() => {
        exchangeCode(mockReq as Request, mockRes as Response);
      }).toThrow("Missing login code");
    });

    it("should throw error for invalid code", () => {
      mockReq.query = { code: "invalid-code" };

      expect(() => {
        exchangeCode(mockReq as Request, mockRes as Response);
      }).toThrow("Invalid or expired login code");
    });
  });
});
