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
        id: "existing123",
        fullName: "Existing User",
        emailInfo: {
          emailAddress: "test@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "google",
        },
        phoneInfo: null,
        passwordInfo: {
          hash: null,
          resetToken: null,
          resetExpires: null,
        },
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
        },
        profileImage: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
        id: "user123",
        fullName: "Test User",
        emailInfo: {
          emailAddress: "test@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "google",
        },
        phoneInfo: null,
        passwordInfo: {
          hash: null,
          resetToken: null,
          resetExpires: null,
        },
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
        },
        profileImage: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await createOAuthUser(mockOAuthUser);

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullname: "Test User",
          email: "test@example.com",
          service: "examaxis",
          emailInfo: {
            isVerified: true,
            provider: "google",
          },
          passwordInfo: {
            hash: null,
          },
          lockoutInfo: {
            isLocked: false,
            failedAttemptCount: 0,
          },
          isActive: true,
          lastLoginAt: expect.any(Date),
        }),
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
        id: "user123",
        fullName: "GitHub User",
        emailInfo: {
          emailAddress: "github@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "github",
        },
        phoneInfo: null,
        passwordInfo: {
          hash: null,
          resetToken: null,
          resetExpires: null,
        },
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
        },
        profileImage: "https://avatars.githubusercontent.com/u/123456",
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
          profileImage: "https://avatars.githubusercontent.com/u/123456",
          emailInfo: {
            isVerified: true,
            provider: "github",
          },
          passwordInfo: {
            hash: null,
          },
          lockoutInfo: {
            isLocked: false,
            failedAttemptCount: 0,
          },
          isActive: true,
          lastLoginAt: expect.any(Date),
        }),
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
        id: "user123",
        fullName: "GitHub User",
        emailInfo: {
          emailAddress: "primary@example.com",
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
          pendingEmail: null,
          provider: "github",
        },
        phoneInfo: null,
        passwordInfo: {
          hash: null,
          resetToken: null,
          resetExpires: null,
        },
        lockoutInfo: {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
        },
        profileImage: "https://avatars.githubusercontent.com/u/123456",
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
