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

// Mock dependencies
jest.mock("passport");
jest.mock("../../src/services/SessionService");
jest.mock("../../src/utils/crypto");

// Mock timers to prevent hanging
jest.useFakeTimers();

const mockPassport = passport as jest.Mocked<typeof passport>;
const mockGenerateTokenPair = generateTokenPair as jest.MockedFunction<
  typeof generateTokenPair
>;
const mockGenerateRandomString = generateRandomString as jest.MockedFunction<
  typeof generateRandomString
>;

describe("OauthController - Key Tests", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      params: { redirectUrl: "http://localhost:3000/callback" },
      query: {
        redirectUrl: "http://localhost:3000/callback",
        service: "examaxis",
        state: JSON.stringify({
          redirectUrl: "http://localhost:3000/callback",
          service: "examaxis",
        }),
      },
      headers: { "user-agent": "test-agent" },
      ip: "127.0.0.1",
      user: {
        id: "user123",
        email: { address: "test@example.com" },
        service: "examaxis",
        toJSON: jest.fn().mockReturnValue({ id: "user123" }),
      } as any,
    };

    mockRes = {
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    mockGenerateTokenPair.mockResolvedValue({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresIn: "3600",
    });

    mockGenerateRandomString.mockReturnValue("mock-random-code");
    mockPassport.authenticate.mockImplementation(() =>
      jest.fn((req, res, next) => next())
    );
  });

  afterEach(() => {
    // Clear all timers after each test
    jest.clearAllTimers();
  });

  afterAll(() => {
    // Restore real timers after all tests
    jest.useRealTimers();
  });

  describe("googleAuth", () => {
    it("should initiate Google OAuth with correct parameters", async () => {
      await googleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPassport.authenticate).toHaveBeenCalledWith("google", {
        scope: ["profile", "email"],
        accessType: "offline",
        prompt: "select_account",
        state: JSON.stringify({
          redirectUrl: "http://localhost:3000/callback",
          service: "examaxis",
        }),
      });
    });
  });

  describe("googleCallback", () => {
    it("should generate tokens and redirect with login code", async () => {
      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockGenerateTokenPair).toHaveBeenCalledWith(
        mockReq.user,
        "test-agent",
        "127.0.0.1"
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/callback?code=mock-random-code"
      );
    });

    it("should handle token generation errors", async () => {
      const error = new Error("Token generation failed");
      mockGenerateTokenPair.mockRejectedValue(error);

      await googleCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("githubAuth", () => {
    it("should initiate GitHub OAuth with correct parameters", async () => {
      await githubAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPassport.authenticate).toHaveBeenCalledWith("github", {
        scope: ["user:email"],
        state: JSON.stringify({
          redirectUrl: "http://localhost:3000/callback",
          service: "examaxis",
        }),
      });
    });
  });

  describe("githubCallback", () => {
    it("should generate tokens and redirect with login code", async () => {
      await githubCallback(mockReq as Request, mockRes as Response, mockNext);

      expect(mockGenerateTokenPair).toHaveBeenCalledWith(
        mockReq.user,
        "test-agent",
        "127.0.0.1"
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/callback?code=mock-random-code"
      );
    });
  });

  describe("exchangeCode", () => {
    it("should throw error for invalid code", () => {
      mockReq.query = { code: "invalid-code" };

      expect(() => {
        exchangeCode(mockReq as Request, mockRes as Response);
      }).toThrow("Invalid or expired login code");
    });
  });
});
