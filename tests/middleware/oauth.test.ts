import type { Request, Response, NextFunction } from "express";
import Passport from "passport";
import { authenticateWithService } from "../../src/middleware/oauth";
import { getStrategyName } from "../../src/config/passport";

// Mock dependencies
jest.mock("passport");
jest.mock("../../src/config/passport");
jest.mock("../../src/helpers/logger");

const mockedPassport = Passport as jest.Mocked<typeof Passport>;
const mockedGetStrategyName = getStrategyName as jest.MockedFunction<
  typeof getStrategyName
>;

describe("OAuth Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("authenticateWithService", () => {
    it("should authenticate with correct strategy based on state", () => {
      mockRequest.query = {
        state: JSON.stringify({ serviceId: "examaxis" }),
      };

      mockedGetStrategyName.mockReturnValue("google-examaxis");
      mockedPassport.authenticate.mockImplementation(() => jest.fn());

      const middleware = authenticateWithService("google");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedGetStrategyName).toHaveBeenCalledWith("google", "examaxis");
      expect(mockedPassport.authenticate).toHaveBeenCalledWith(
        "google-examaxis",
        {
          session: false,
        }
      );
    });

    it("should throw error when state parameter is missing", () => {
      mockRequest.query = {};

      const middleware = authenticateWithService("google");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing state parameter",
        })
      );
    });

    it("should throw error when serviceId is missing in state", () => {
      mockRequest.query = {
        state: JSON.stringify({ redirectUrl: "http://example.com" }),
      };

      const middleware = authenticateWithService("google");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Missing serviceId in state",
        })
      );
    });

    it("should handle invalid JSON in state parameter", () => {
      mockRequest.query = {
        state: "invalid-json",
      };

      const middleware = authenticateWithService("google");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should work with GitHub provider", () => {
      mockRequest.query = {
        state: JSON.stringify({ serviceId: "examaxis" }),
      };

      mockedGetStrategyName.mockReturnValue("github-examaxis");
      mockedPassport.authenticate.mockImplementation(() => jest.fn());

      const middleware = authenticateWithService("github");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedGetStrategyName).toHaveBeenCalledWith("github", "examaxis");
      expect(mockedPassport.authenticate).toHaveBeenCalledWith(
        "github-examaxis",
        {
          session: false,
        }
      );
    });

    it("should call passport authenticate callback", () => {
      mockRequest.query = {
        state: JSON.stringify({ serviceId: "examaxis" }),
      };

      const mockAuthMiddleware = jest.fn();
      mockedGetStrategyName.mockReturnValue("google-examaxis");
      mockedPassport.authenticate.mockReturnValue(mockAuthMiddleware);

      const middleware = authenticateWithService("google");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthMiddleware).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        mockNext
      );
    });
  });
});
