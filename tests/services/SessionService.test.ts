import * as SessionService from "../../src/services/SessionService";
import * as JwtHelper from "../../src/helpers/jwt";
import { config } from "../../src/config/app";
import { prisma } from "../../src/config/prisma";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    session: {
      create: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock("../../src/helpers/jwt");
jest.mock("../../src/helpers/logger");

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedJwtHelper = JwtHelper as jest.Mocked<typeof JwtHelper>;

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

describe("SessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    it("should create session with refresh token successfully", async () => {
      const mockUser = createMockUser();
      const mockSession = {
        id: "session123",
        userId: mockUser.id,
        deviceId: "device-123",
        refreshToken: "hashed-refresh-token",
        userAgent: "test-agent",
        ipAddress: "127.0.0.1",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockedPrisma.session.upsert as jest.Mock).mockResolvedValue(mockSession);

      const result = await SessionService.createSession(
        mockUser,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );

      expect(mockedPrisma.session.upsert).toHaveBeenCalledWith({
        where: {
          user_device_id: {
            userId: mockUser.id,
            deviceId: "device-123",
          },
        },
        update: {
          refreshToken: expect.any(String),
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
          expiresAt: expect.any(Date),
        },
        create: {
          userId: mockUser.id,
          deviceId: "device-123",
          refreshToken: expect.any(String),
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
          expiresAt: expect.any(Date),
        },
      });
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe("hashed-refresh-token");
    });

    it("should create session without userAgent and ipAddress", async () => {
      const mockUser = createMockUser();
      const mockSession = {
        id: "session123",
        userId: mockUser.id,
        deviceId: "device-123",
        refreshToken: "hashed-refresh-token",
        userAgent: null,
        ipAddress: null,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockedPrisma.session.upsert as jest.Mock).mockResolvedValue(mockSession);

      const result = await SessionService.createSession(mockUser, "device-123");

      expect(mockedPrisma.session.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userAgent: null,
            ipAddress: null,
          }),
        })
      );
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe("generateTokenPair", () => {
    it("should generate access token and create session", async () => {
      const mockUser = createMockUser();
      const mockAccessToken = "access-token-123";
      const mockSession = {
        id: "session123",
        userId: mockUser.id,
        deviceId: "device-123",
        refreshToken: "hashed-refresh-token",
      };

      mockedJwtHelper.generateAccessToken.mockReturnValue(mockAccessToken);
      (mockedPrisma.session.upsert as jest.Mock).mockResolvedValue(mockSession);

      const result = await SessionService.generateTokenPair(
        mockUser,
        "device-123",
        "test-agent",
        "127.0.0.1"
      );

      expect(mockedJwtHelper.generateAccessToken).toHaveBeenCalledWith(
        mockUser
      );
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(config.jwt.expiresIn);
    });

    it("should generate token pair without optional parameters", async () => {
      const mockUser = createMockUser();
      const mockAccessToken = "access-token-123";

      mockedJwtHelper.generateAccessToken.mockReturnValue(mockAccessToken);
      (mockedPrisma.session.upsert as jest.Mock).mockResolvedValue({
        id: "session123",
        userId: mockUser.id,
        deviceId: "device-123",
      });

      const result = await SessionService.generateTokenPair(
        mockUser,
        "device-123"
      );

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: expect.any(String),
        expiresIn: config.jwt.expiresIn,
      });
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh access token successfully", async () => {
      const mockUser = createMockUser();
      const mockSession = {
        id: "session123",
        userId: mockUser.id,
        deviceId: "device-123",
        refreshToken: "hashed-refresh-token",
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      };

      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValue(
        mockSession
      );
      mockedJwtHelper.generateAccessToken.mockReturnValue("new-access-token");
      (mockedPrisma.session.upsert as jest.Mock).mockResolvedValue({
        id: "session456",
        userId: mockUser.id,
        deviceId: "device-123",
      });

      const result = await SessionService.refreshAccessToken(
        "valid-refresh-token",
        "device-123",
        "test-agent",
        "127.0.0.1"
      );

      expect(mockedPrisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          refreshToken: expect.any(String),
          expiresAt: { gt: expect.any(Date) },
        },
        include: { user: true },
      });
      expect(result.accessToken).toBe("new-access-token");
    });

    it("should throw error for invalid refresh token", async () => {
      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        SessionService.refreshAccessToken("invalid-token", "device-123")
      ).rejects.toThrow("Invalid or expired refresh token");
    });

    it("should throw error when user not found in session", async () => {
      const mockSession = {
        id: "session123",
        userId: "user-id",
        deviceId: "device-123",
        refreshToken: "hashed-refresh-token",
        expiresAt: new Date(Date.now() + 86400000),
        user: null,
      };

      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValue(
        mockSession
      );

      await expect(
        SessionService.refreshAccessToken("valid-token", "device-123")
      ).rejects.toThrow("User not found");
    });

    it("should use session deviceId when not provided", async () => {
      const mockUser = createMockUser();
      const mockSession = {
        id: "session123",
        userId: mockUser.id,
        deviceId: "original-device-123",
        refreshToken: "hashed-refresh-token",
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      };

      (mockedPrisma.session.findFirst as jest.Mock).mockResolvedValue(
        mockSession
      );
      mockedJwtHelper.generateAccessToken.mockReturnValue("new-access-token");
      (mockedPrisma.session.upsert as jest.Mock).mockResolvedValue({
        id: "session456",
        userId: mockUser.id,
        deviceId: "original-device-123",
      });

      const result = await SessionService.refreshAccessToken(
        "valid-refresh-token"
      );

      expect(result.accessToken).toBe("new-access-token");
    });
  });

  describe("revokeUserSession", () => {
    it("should revoke user session successfully", async () => {
      (mockedPrisma.session.delete as jest.Mock).mockResolvedValue({});

      await SessionService.revokeUserSession("user-id", "device-123");

      expect(mockedPrisma.session.delete).toHaveBeenCalledWith({
        where: {
          user_device_id: {
            userId: "user-id",
            deviceId: "device-123",
          },
        },
      });
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should revoke all user sessions successfully", async () => {
      (mockedPrisma.session.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await SessionService.revokeAllUserSessions("user-id");

      expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-id" },
      });
    });
  });
});
