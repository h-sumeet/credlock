import type { Request, Response, NextFunction } from "express";
import { authenticate, clientContext } from "../../src/middleware/auth";
import * as JwtHelper from "../../src/helpers/jwt";
import type { IJWTPayload } from "../../src/types/auth";
import { SERVICES } from "../../src/constants/common";

// Mock dependencies
jest.mock("../../src/helpers/jwt");
jest.mock("../../src/helpers/logger");

const mockedJwtHelper = JwtHelper as jest.Mocked<typeof JwtHelper>;

describe("Authentication Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      serviceId: "examaxis",
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
      const mockPayload: IJWTPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
        serviceId: "examaxis",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };
      mockRequest.serviceId = "examaxis";

      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwtHelper.verifyAccessToken).toHaveBeenCalledWith(
        "valid-token",
        "examaxis"
      );
      expect(mockRequest.userId).toBe(mockPayload.userId);
      expect(mockRequest.serviceId).toBe(mockPayload.serviceId);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject request without authorization header", async () => {
      mockRequest.headers = {};

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access token and refresh token are required",
        })
      );
    });

    it("should reject request without Bearer prefix", async () => {
      mockRequest.headers = {
        authorization: "invalid-token",
      };

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access token and refresh token are required",
        })
      );
    });

    it("should reject request with only Bearer prefix", async () => {
      mockRequest.headers = {
        authorization: "Bearer ",
      };

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Empty token after trim
      expect(mockedJwtHelper.verifyAccessToken).toHaveBeenCalledWith(
        "",
        "examaxis"
      );
    });

    it("should reject request with invalid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
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
    });

    it("should reject request with expired token", async () => {
      mockRequest.headers = {
        authorization: "Bearer expired-token",
      };

      mockedJwtHelper.verifyAccessToken.mockImplementation(() => {
        throw new Error("Access token has expired");
      });

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access token has expired",
        })
      );
    });

    it("should reject request with missing userId in payload", async () => {
      const mockPayload = {
        email: "test@example.com",
        serviceId: "examaxis",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };

      mockedJwtHelper.verifyAccessToken.mockReturnValue(
        mockPayload as IJWTPayload
      );

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token payload",
        })
      );
    });

    it("should reject request with missing serviceId in payload", async () => {
      const mockPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };

      mockedJwtHelper.verifyAccessToken.mockReturnValue(
        mockPayload as IJWTPayload
      );

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token payload",
        })
      );
    });

    it("should reject request with mismatched serviceId", async () => {
      const mockPayload: IJWTPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
        serviceId: "other-service",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };
      mockRequest.serviceId = "examaxis";

      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Service Id not matching",
        })
      );
    });

    it("should trim token whitespace", async () => {
      const mockPayload: IJWTPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
        serviceId: "examaxis",
      };

      mockRequest.headers = {
        authorization: "Bearer   valid-token   ",
      };
      mockRequest.serviceId = "examaxis";

      mockedJwtHelper.verifyAccessToken.mockReturnValue(mockPayload);

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwtHelper.verifyAccessToken).toHaveBeenCalledWith(
        "valid-token",
        "examaxis"
      );
    });
  });

  describe("clientContext", () => {
    it("should extract valid service and device headers", () => {
      mockRequest.headers = {
        "x-service-id": "examaxis",
        "x-device-id": "device-123",
      };

      clientContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.serviceId).toBe("examaxis");
      expect(mockRequest.deviceId).toBe("device-123");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject request without service header", () => {
      mockRequest.headers = {
        "x-device-id": "device-123",
      };

      clientContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Service header is required",
        })
      );
    });

    it("should reject request with invalid service", () => {
      mockRequest.headers = {
        "x-service-id": "invalid-service",
        "x-device-id": "device-123",
      };

      clientContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid service.",
        })
      );
    });

    it("should allow request without device header", () => {
      mockRequest.headers = {
        "x-service-id": "examaxis",
      };

      clientContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.serviceId).toBe("examaxis");
      expect(mockRequest.deviceId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should validate all valid services", () => {
      Object.values(SERVICES).forEach((service) => {
        mockRequest.headers = {
          "x-service-id": service,
          "x-device-id": "device-123",
        };

        clientContext(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockRequest.serviceId).toBe(service);
      });
    });
  });
});
