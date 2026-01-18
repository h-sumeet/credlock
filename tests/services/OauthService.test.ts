import type { Profile as GitHubProfile } from "passport-github2";
import type { Profile as GoogleProfile } from "passport-google-oauth20";
import {
  createOAuthUser,
  handleGithubAuth,
  handleGoogleAuth,
} from "../../src/services/OauthService";
import { AUTH_PROVIDERS, GITHUB_EMAIL_API } from "../../src/constants/common";
import type { IOAuthUser } from "../../src/types/user";
import { prisma } from "../../src/config/prisma";
import type { User } from "@prisma/client";

// Mock dependencies
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));
jest.mock("../../src/helpers/logger");

// Mock fetch globally
global.fetch = jest.fn();

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Helper to create mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
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
  ...overrides,
});

describe("OauthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOAuthUser", () => {
    it("should return existing user if found", async () => {
      const existingUser = createMockUser();
      const mockOAuthUser: IOAuthUser = {
        email: "test@example.com",
        displayName: "Test User",
        provider: AUTH_PROVIDERS.GOOGLE,
        isVerified: true,
        serviceId: "examaxis",
      };

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(
        existingUser
      );

      const result = await createOAuthUser(mockOAuthUser);

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: "test@example.com",
          serviceId: "examaxis",
        },
      });
      expect(result).toBe(existingUser);
      expect(mockedPrisma.user.create).not.toHaveBeenCalled();
    });

    it("should create new user if not found", async () => {
      const newUser = createMockUser();
      const mockOAuthUser: IOAuthUser = {
        email: "new@example.com",
        displayName: "New User",
        provider: AUTH_PROVIDERS.GOOGLE,
        isVerified: true,
        serviceId: "examaxis",
      };

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await createOAuthUser(mockOAuthUser);

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "New User",
          email: "new@example.com",
          serviceId: "examaxis",
          provider: "google",
          emailInfo: {
            create: { isVerified: true },
          },
          passwordInfo: {
            create: { hash: null },
          },
        }),
      });
      expect(result).toBe(newUser);
    });

    it("should create user with avatar if provided", async () => {
      const newUser = createMockUser({
        avatar: "https://example.com/avatar.jpg",
      });
      const mockOAuthUser: IOAuthUser = {
        email: "new@example.com",
        displayName: "New User",
        avatarUrl: "https://example.com/avatar.jpg",
        provider: AUTH_PROVIDERS.GOOGLE,
        isVerified: true,
        serviceId: "examaxis",
      };

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      await createOAuthUser(mockOAuthUser);

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          avatar: "https://example.com/avatar.jpg",
        }),
      });
    });
  });

  describe("handleGoogleAuth", () => {
    const createMockGoogleProfile = (
      overrides: Partial<GoogleProfile> = {}
    ): GoogleProfile =>
      ({
        id: "google-123",
        displayName: "Test User",
        emails: [{ value: "test@example.com", verified: true }],
        photos: [{ value: "https://example.com/photo.jpg" }],
        provider: "google",
        name: { familyName: "User", givenName: "Test" },
        ...overrides,
      }) as GoogleProfile;

    it("should create or find user from Google profile", async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockGoogleProfile();

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await handleGoogleAuth(
        mockProfile,
        AUTH_PROVIDERS.GOOGLE,
        "examaxis"
      );

      expect(result).toBe(mockUser);
    });

    it("should throw error when no email found", async () => {
      const mockProfile = createMockGoogleProfile({ emails: [] });

      await expect(
        handleGoogleAuth(mockProfile, AUTH_PROVIDERS.GOOGLE, "examaxis")
      ).rejects.toThrow("No email found in OAuth profile");
    });

    it("should throw error when no display name found", async () => {
      const mockProfile = createMockGoogleProfile({
        displayName: "",
        name: undefined,
      });

      await expect(
        handleGoogleAuth(mockProfile, AUTH_PROVIDERS.GOOGLE, "examaxis")
      ).rejects.toThrow("No display name found in OAuth profile");
    });

    it("should use givenName when displayName is empty", async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockGoogleProfile({
        displayName: "",
        name: { givenName: "John", familyName: "Doe" },
      });

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await handleGoogleAuth(mockProfile, AUTH_PROVIDERS.GOOGLE, "examaxis");

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "John",
        }),
      });
    });
  });

  describe("handleGithubAuth", () => {
    const createMockGithubProfile = (
      overrides: Partial<GitHubProfile> = {}
    ): GitHubProfile =>
      ({
        id: "github-123",
        displayName: "Test User",
        username: "testuser",
        profileUrl: "https://github.com/testuser",
        emails: [{ value: "test@example.com" }],
        photos: [{ value: "https://avatars.githubusercontent.com/123" }],
        provider: "github",
        ...overrides,
      }) as GitHubProfile;

    it("should create or find user from GitHub profile", async () => {
      const mockUser = createMockUser({ provider: "github" });
      const mockProfile = createMockGithubProfile();

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await handleGithubAuth(
        mockProfile,
        "test-access-token",
        "examaxis"
      );

      expect(result).toBe(mockUser);
    });

    it("should fetch email from GitHub API if not in profile", async () => {
      const mockUser = createMockUser({ provider: "github" });
      const mockProfile = createMockGithubProfile({ emails: undefined });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { email: "primary@example.com", primary: true, verified: true },
            { email: "secondary@example.com", primary: false, verified: true },
          ]),
      } as Response);

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await handleGithubAuth(
        mockProfile,
        "test-access-token",
        "examaxis"
      );

      expect(mockFetch).toHaveBeenCalledWith(GITHUB_EMAIL_API, {
        headers: { Authorization: "token test-access-token" },
      });
      expect(result).toBe(mockUser);
    });

    it("should use first email if no primary email found", async () => {
      const mockUser = createMockUser({ provider: "github" });
      const mockProfile = createMockGithubProfile({ emails: undefined });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { email: "first@example.com", primary: false, verified: true },
            { email: "second@example.com", primary: false, verified: true },
          ]),
      } as Response);

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await handleGithubAuth(mockProfile, "test-access-token", "examaxis");

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "first@example.com",
        }),
      });
    });

    it("should throw error when GitHub API fails", async () => {
      const mockProfile = createMockGithubProfile({ emails: undefined });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(
        handleGithubAuth(mockProfile, "invalid-token", "examaxis")
      ).rejects.toThrow("Unable to retrieve user email from GitHub");
    });

    it("should throw error when no email can be retrieved", async () => {
      const mockProfile = createMockGithubProfile({ emails: undefined });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await expect(
        handleGithubAuth(mockProfile, "test-access-token", "examaxis")
      ).rejects.toThrow("No email found for GitHub user");
    });

    it("should throw error when no display name found", async () => {
      const mockProfile = createMockGithubProfile({
        displayName: "",
        username: undefined,
      });

      await expect(
        handleGithubAuth(mockProfile, "test-access-token", "examaxis")
      ).rejects.toThrow("No display name found in GitHub profile");
    });

    it("should use username when displayName is empty", async () => {
      const mockUser = createMockUser({ provider: "github" });
      const mockProfile = createMockGithubProfile({
        displayName: "",
        username: "testuser",
      });

      (mockedPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await handleGithubAuth(mockProfile, "test-access-token", "examaxis");

      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "testuser",
        }),
      });
    });
  });
});
