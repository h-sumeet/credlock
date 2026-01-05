import type { Profile as GitHubProfile } from "passport-github2";
import {
  createOAuthUser,
  handleGithubAuth,
} from "../../src/services/OauthService";
import { GITHUB_EMAIL_API, AUTH_PROVIDERS } from "../../src/constants/common";
import type { IOAuthUser } from "../../src/types/user";
import { prisma } from "../../src/config/prisma";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));
jest.mock("../../src/helpers/logger");

// Mock fetch globally
global.fetch = jest.fn();

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe("OauthService - Core Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOAuthUser", () => {
    it("should return existing user if found", async () => {
      const mockOAuthUser: IOAuthUser = {
        email: "test@example.com",
        displayName: "Test User",
        provider: AUTH_PROVIDERS.GOOGLE,
        isVerified: true,
        service: "examaxis",
      };

      const existingUser = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        fullname: "Existing User",
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
          provider: "google",
          created_at: new Date(),
          updated_at: new Date(),
        },
        phone_info: null,
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: null,
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
      } as any;
      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(
        existingUser
      );

      const result = await createOAuthUser(mockOAuthUser);

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: "test@example.com",
          service: "examaxis",
        },
        include: expect.any(Object),
      });
      expect(result).toBe(existingUser);
    });

    it("should create new user if not found", async () => {
      const mockOAuthUser: IOAuthUser = {
        email: "test@example.com",
        displayName: "Test User",
        provider: AUTH_PROVIDERS.GOOGLE,
        isVerified: true,
        service: "examaxis",
      };

      const newUser = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        fullname: "Test User",
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
          provider: "google",
          created_at: new Date(),
          updated_at: new Date(),
        },
        phone_info: null,
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: null,
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
      } as any;

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await createOAuthUser(mockOAuthUser);

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullname: "Test User",
          email: "test@example.com",
          service: "examaxis",
          email_info: {
            create: expect.objectContaining({
              is_verified: true,
              provider: "google",
            }),
          },
          password_info: {
            create: expect.objectContaining({
              hash: null,
            }),
          },
          lockout_info: {
            create: expect.objectContaining({
              is_locked: false,
              failed_attempt_count: 0,
            }),
          },
          is_active: true,
          last_login_at: expect.any(Date),
        }),
        include: expect.any(Object),
      });
      expect(result).toBe(newUser);
    });
  });

  describe("handleGithubAuth", () => {
    it("should handle GitHub profile with email", async () => {
      const mockGitHubProfile = {
        id: "github123",
        username: "githubuser",
        displayName: "GitHub User",
        emails: [{ value: "github@example.com" }],
        photos: [{ value: "https://avatars.githubusercontent.com/u/123456" }],
        provider: "github",
      } as GitHubProfile;

      const mockUserDoc = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        fullname: "GitHub User",
        email: "github@example.com",
        phone: null,
        service: "examaxis",
        profile_image: "https://avatars.githubusercontent.com/u/123456",
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
          provider: "github",
          created_at: new Date(),
          updated_at: new Date(),
        },
        phone_info: null,
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: null,
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
      } as any;

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUserDoc);

      const result = await handleGithubAuth(
        mockGitHubProfile,
        "github_access_token",
        "examaxis"
      );

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullname: "GitHub User",
          email: "github@example.com",
          profile_image: "https://avatars.githubusercontent.com/u/123456",
          email_info: {
            create: expect.objectContaining({
              is_verified: true,
              provider: "github",
            }),
          },
          password_info: {
            create: expect.objectContaining({
              hash: null,
            }),
          },
          lockout_info: {
            create: expect.objectContaining({
              is_locked: false,
              failed_attempt_count: 0,
            }),
          },
          is_active: true,
          last_login_at: expect.any(Date),
        }),
        include: expect.any(Object),
      });
      expect(result).toBe(mockUserDoc);
    });

    it("should fetch email from GitHub API when not in profile", async () => {
      const profileNoEmail = {
        id: "github123",
        username: "githubuser",
        displayName: "GitHub User",
        emails: undefined,
        photos: [{ value: "https://avatars.githubusercontent.com/u/123456" }],
        provider: "github",
      } as GitHubProfile;

      const mockEmails = [
        { email: "primary@example.com", primary: true, verified: true },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmails),
      } as any);

      const mockUserDoc = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        fullname: "GitHub User",
        email: "primary@example.com",
        phone: null,
        service: "examaxis",
        profile_image: "https://avatars.githubusercontent.com/u/123456",
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
          provider: "github",
          created_at: new Date(),
          updated_at: new Date(),
        },
        phone_info: null,
        password_info: {
          id: "password-info-id",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          hash: null,
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
      } as any;

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUserDoc);

      const result = await handleGithubAuth(
        profileNoEmail,
        "github_access_token",
        "examaxis"
      );

      expect(mockFetch).toHaveBeenCalledWith(GITHUB_EMAIL_API, {
        headers: { Authorization: "token github_access_token" },
      });
      expect(result).toBe(mockUserDoc);
    });
  });
});
