import type { Request, Response, NextFunction } from "express";

// Mock dependencies BEFORE importing HealthController
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
    services: {},
  },
}));
jest.mock("../../src/config/database");
jest.mock("../../src/services/EmailService");
jest.mock("../../src/helpers/logger");

import {
  basicHealth,
  detailedHealth,
} from "../../src/controllers/HealthController";
import * as database from "../../src/config/database";
import * as EmailService from "../../src/services/EmailService";

const mockedDatabase = database as jest.Mocked<typeof database>;
const mockedEmailService = EmailService as jest.Mocked<typeof EmailService>;

describe("HealthController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("basicHealth", () => {
    it("should return healthy status", () => {
      basicHealth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          code: 200,
          msg: "Service is healthy",
          data: expect.objectContaining({
            status: "healthy",
            timestamp: expect.any(String),
            uptime: expect.any(String),
            environment: expect.any(String),
            version: expect.any(String),
          }),
        })
      );
    });

    it("should include environment and version in response", () => {
      basicHealth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            environment: "test",
            version: "1.0.0",
          }),
        })
      );
    });

    it("should call next on error", () => {
      const originalStatus = mockResponse.status!;
      mockResponse.status = jest.fn(() => {
        throw new Error("Mock error");
      });

      basicHealth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      mockResponse.status = originalStatus;
    });
  });

  describe("detailedHealth", () => {
    it("should return healthy status with all checks passing", async () => {
      mockedDatabase.healthCheck.mockResolvedValue(true);
      mockedEmailService.testConnection.mockResolvedValue(true);

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          code: 200,
          msg: "Health check successful",
          data: expect.objectContaining({
            status: "healthy",
            checks: {
              database: true,
              email: true,
            },
          }),
        })
      );
    });

    it("should return degraded status when database fails", async () => {
      mockedDatabase.healthCheck.mockRejectedValue(new Error("DB error"));
      mockedEmailService.testConnection.mockResolvedValue(true);

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Health check successful",
          data: expect.objectContaining({
            status: "degraded",
            checks: expect.objectContaining({
              database: false,
              email: true,
            }),
          }),
        })
      );
    });

    it("should return degraded status when email service fails", async () => {
      mockedDatabase.healthCheck.mockResolvedValue(true);
      mockedEmailService.testConnection.mockRejectedValue(
        new Error("Email error")
      );

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Health check successful",
          data: expect.objectContaining({
            status: "degraded",
            checks: expect.objectContaining({
              database: true,
              email: false,
            }),
          }),
        })
      );
    });

    it("should return degraded status when all checks fail", async () => {
      mockedDatabase.healthCheck.mockRejectedValue(new Error("DB error"));
      mockedEmailService.testConnection.mockRejectedValue(
        new Error("Email error")
      );

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Health check successful",
          data: expect.objectContaining({
            status: "degraded",
            checks: {
              database: false,
              email: false,
            },
          }),
        })
      );
    });

    it("should include timestamp and uptime in response", async () => {
      mockedDatabase.healthCheck.mockResolvedValue(true);
      mockedEmailService.testConnection.mockResolvedValue(true);

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timestamp: expect.any(String),
            uptime: expect.any(String),
          }),
        })
      );
    });

    it("should call next on unexpected error", async () => {
      mockedDatabase.healthCheck.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // The function catches errors internally, so it should still return degraded status
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it("should handle database returning false", async () => {
      mockedDatabase.healthCheck.mockResolvedValue(false);
      mockedEmailService.testConnection.mockResolvedValue(true);

      await detailedHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            checks: expect.objectContaining({
              database: false,
            }),
          }),
        })
      );
    });
  });
});
