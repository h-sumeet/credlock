import jwt from "jsonwebtoken";
import { generateAccessToken, verifyAccessToken } from "../../src/helpers/jwt";
import { config } from "../../src/config/app";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("../../src/config/app");
jest.mock("jsonwebtoken");

const mockedConfig = config as jest.Mocked<typeof config>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe("JWT Helpers", () => {
  const mockUser: User = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "John Doe",
    email: "test@example.com",
    phone: null,
    avatar: null,
    provider: "local",
    serviceId: "examaxis",
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config values
    mockedConfig.jwt = {
      secret: "test-secret-key",
      refreshSecret: "test-refresh-secret",
      expiresIn: "15m",
      refreshExpiresIn: "7d",
    };

    mockedConfig.app = {
      name: "CredLock",
      url: "http://localhost:3000",
    };
  });

  describe("generateAccessToken", () => {
    it("should generate access token with correct payload", () => {
      const expectedToken = "mock.jwt.token";
      const expectedPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        serviceId: mockUser.serviceId,
      };

      mockedJwt.sign.mockReturnValue(expectedToken as any);

      const result = generateAccessToken(mockUser);

      expect(result).toBe(expectedToken);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expectedPayload,
        mockedConfig.jwt.secret,
        {
          expiresIn: mockedConfig.jwt.expiresIn,
          issuer: mockedConfig.app.name,
          audience: mockedConfig.app.name,
          algorithm: "HS256",
        }
      );
    });

    it("should include serviceId in token payload", () => {
      const expectedToken = "mock.jwt.token";
      mockedJwt.sign.mockReturnValue(expectedToken as any);

      generateAccessToken(mockUser);

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: "examaxis",
        }),
        mockedConfig.jwt.secret,
        expect.any(Object)
      );
    });

    it("should use correct JWT options", () => {
      const expectedToken = "mock.jwt.token";
      mockedJwt.sign.mockReturnValue(expectedToken as any);

      generateAccessToken(mockUser);

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        mockedConfig.jwt.secret,
        {
          expiresIn: mockedConfig.jwt.expiresIn,
          issuer: mockedConfig.app.name,
          audience: mockedConfig.app.name,
          algorithm: "HS256",
        }
      );
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify valid token successfully", () => {
      const mockToken = "valid.jwt.token";
      const expectedPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
        serviceId: "examaxis",
        iat: 1234567890,
        exp: 1234567890 + 900,
      };

      mockedJwt.verify.mockReturnValue(expectedPayload as any);

      const result = verifyAccessToken(mockToken, "examaxis");

      expect(result).toEqual(expectedPayload);
      expect(mockedJwt.verify).toHaveBeenCalledWith(
        mockToken,
        mockedConfig.jwt.secret,
        {
          issuer: mockedConfig.app.name,
          audience: mockedConfig.app.name,
          algorithms: ["HS256"],
        }
      );
    });

    it("should throw error for expired token", () => {
      const mockToken = "expired.jwt.token";

      const expiredError = new jwt.TokenExpiredError("jwt expired", new Date());
      mockedJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      expect(() => verifyAccessToken(mockToken, "examaxis")).toThrow(
        "Access token has expired"
      );
    });

    it("should throw error for token not yet valid", () => {
      const mockToken = "future.jwt.token";

      const notBeforeError = new jwt.NotBeforeError(
        "jwt not active",
        new Date()
      );
      mockedJwt.verify.mockImplementation(() => {
        throw notBeforeError;
      });

      expect(() => verifyAccessToken(mockToken, "examaxis")).toThrow(
        "Access token not yet valid"
      );
    });

    it("should throw error for invalid token", () => {
      const mockToken = "invalid.jwt.token";

      const jsonWebTokenError = new jwt.JsonWebTokenError("invalid token");
      mockedJwt.verify.mockImplementation(() => {
        throw jsonWebTokenError;
      });

      expect(() => verifyAccessToken(mockToken, "examaxis")).toThrow(
        "Invalid access token"
      );
    });

    it("should throw generic error for unknown errors", () => {
      const mockToken = "error.jwt.token";

      mockedJwt.verify.mockImplementation(() => {
        throw new Error("Unknown error");
      });

      expect(() => verifyAccessToken(mockToken, "examaxis")).toThrow(
        "Invalid or expired access token"
      );
    });

    it("should use correct verification options", () => {
      const mockToken = "valid.jwt.token";
      const mockPayload = {
        userId: "user-id",
        email: "test@example.com",
        serviceId: "examaxis",
      };

      mockedJwt.verify.mockReturnValue(mockPayload as any);

      verifyAccessToken(mockToken, "examaxis");

      expect(mockedJwt.verify).toHaveBeenCalledWith(
        mockToken,
        mockedConfig.jwt.secret,
        {
          issuer: mockedConfig.app.name,
          audience: mockedConfig.app.name,
          algorithms: ["HS256"],
        }
      );
    });
  });
});
