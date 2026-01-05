import * as SessionService from "../../src/services/SessionService";
import * as JwtHelper from "../../src/helpers/jwt";
import { config } from "../../src/config/app";
import { prisma } from "../../src/config/prisma";
import type { UserDetails } from "../../src/types/user";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    session: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock("../../src/helpers/jwt");

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedJwtHelper = JwtHelper as jest.Mocked<typeof JwtHelper>;

// Helper function to create clean mock user objects with PostgreSQL schema
const createMockUser = (overrides: Partial<any> = {}): UserDetails => {
  const defaultUser: UserDetails = {
    id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
    fullname: "John Doe",
    email: "john@example.com",
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
      is_verified: false,
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
      hash: "hashedpassword",
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

  return { ...defaultUser, ...overrides };
};

describe("SessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    it("should create session with refresh token successfully", async () => {
      const mockUser = createMockUser();
      const mockSession = {
        id: "session123",
        user_id: mockUser.id,
        refresh_token: "hashed-refresh-token",
        user_agent: "test-agent",
        ip_address: "127.0.0.1",
        expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      } as any;

      (mockedPrisma.session.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await SessionService.createSession(
        mockUser,
        "test-agent",
        "127.0.0.1"
      );

      expect(mockedPrisma.session.create).toHaveBeenCalledWith({
        data: {
          user_id: mockUser.id,
          refresh_token: expect.any(String), // hashed token
          user_agent: "test-agent",
          ip_address: "127.0.0.1",
          expires_at: expect.any(Date),
        },
      });
      expect(result.session).toBe(mockSession);
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe("hashed-refresh-token"); // Should be plain token
    });

    it("should create session without userAgent and ipAddress", async () => {
      const mockUser = createMockUser();
      const mockSession = {
        id: "session123",
        user_id: mockUser.id,
        refresh_token: "hashed-refresh-token",
        user_agent: null,
        ip_address: null,
        expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      } as any;

      (mockedPrisma.session.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await SessionService.createSession(mockUser);

      expect(mockedPrisma.session.create).toHaveBeenCalledWith({
        data: {
          user_id: mockUser.id,
          refresh_token: expect.any(String),
          user_agent: null,
          ip_address: null,
          expires_at: expect.any(Date),
        },
      });
      expect(result.session).toBe(mockSession);
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe("generateTokenPair", () => {
    it("should generate access token and create session", async () => {
      const mockUser = createMockUser();
      const mockAccessToken = "access-token-123";
      const mockSession = {
        id: "session123",
        refreshToken: "plain-refresh-token",
      } as any;

      mockedJwtHelper.generateAccessToken.mockReturnValue(mockAccessToken);

      // Mock the createSession function
      const createSessionSpy = jest.spyOn(SessionService, "createSession");
      createSessionSpy.mockResolvedValue(mockSession);

      const result = await SessionService.generateTokenPair(
        mockUser,
        "test-agent",
        "127.0.0.1"
      );

      expect(mockedJwtHelper.generateAccessToken).toHaveBeenCalledWith(
        mockUser
      );
      expect(createSessionSpy).toHaveBeenCalledWith(
        mockUser,
        "test-agent",
        "127.0.0.1"
      );
      expect(result).toEqual({
        accessToken: "access-token-123",
        refreshToken: "plain-refresh-token",
        expiresIn: config.jwt.expiresIn,
      });
    });
  });

  describe("revokeRefreshToken", () => {
    it("should revoke refresh token successfully", async () => {
      const mockSession = {
        id: "session123",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        refresh_token: "hashed-token",
      } as any;

      (mockedPrisma.session.delete as jest.Mock).mockResolvedValue(mockSession);

      await SessionService.revokeRefreshToken("refresh-token");

      expect(mockedPrisma.session.delete).toHaveBeenCalledWith({
        where: {
          refresh_token: expect.any(String), // hashed token
        },
      });
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should revoke all user sessions successfully", async () => {
      const validUserId = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID
      (mockedPrisma.session.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await SessionService.revokeAllUserSessions(validUserId);

      expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          user_id: validUserId,
        },
      });
    });
  });
});
