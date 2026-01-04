import type { Profile as GoogleProfile } from "passport-google-oauth20";
import type { Profile as GitHubProfile } from "passport-github2";
import { prisma } from "../config/prisma";
import { logger } from "../helpers/logger";
import { GITHUB_EMAIL_API, AUTH_PROVIDERS } from "../constants/common";
import type { IOAuthUser } from "../types/user";
import { throwError } from "../utils/response";
import type { User } from "@prisma/client";
import { currentDate } from "../utils/dayjs";

/**
 * Create or find user from OAuth provider
 */
export const createOAuthUser = async (oauthUser: IOAuthUser): Promise<User> => {
  const { email, displayName, avatarUrl, provider, service } = oauthUser;

  const existingUser = await prisma.user.findFirst({
    where: { email, service },
  });

  if (existingUser) return existingUser;

  const newUser = await prisma.user.create({
    data: {
      fullname: displayName,
      email,
      service,
      ...(avatarUrl && { profileImage: avatarUrl }),
      emailInfo: {
        isVerified: true,
        ...(provider && { provider }),
      },
      passwordInfo: {
        hash: null,
      },
      lockoutInfo: {
        isLocked: false,
        failedAttemptCount: 0,
      },
      isActive: true,
      lastLoginAt: currentDate(),
    },
  });

  return newUser;
};

/**
 * Create or find user from OAuth provider
 */
export const handleGoogleAuth = async (
  profile: GoogleProfile,
  provider: typeof AUTH_PROVIDERS.GOOGLE,
  service: string
): Promise<User> => {
  const email = profile.emails?.[0]?.value;
  const avatarUrl = profile.photos?.[0]?.value;
  const displayName = profile.displayName || profile.name?.givenName;

  if (!email) throwError("No email found in OAuth profile", 400);
  if (!displayName) throwError("No display name found in OAuth profile", 400);

  const oauthUser: IOAuthUser = {
    email,
    service,
    displayName,
    ...(avatarUrl && { avatarUrl }),
    provider,
    isVerified: true,
  };

  return await createOAuthUser(oauthUser);
};

/**
 * Handle GitHub email fetching and user creation
 */
export const handleGithubAuth = async (
  profile: GitHubProfile,
  accessToken: string,
  service: string
): Promise<User> => {
  let email = profile.emails?.[0]?.value;

  // Fetch email from GitHub API if not in profile
  if (!email) {
    try {
      const response = await fetch(GITHUB_EMAIL_API, {
        headers: { Authorization: `token ${accessToken}` },
      });

      if (!response.ok) throwError(`GitHub API error: ${response.status}`, 400);

      const emails = (await response.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];

      const primaryEmail = emails.find((e) => e.primary)?.email;
      email = primaryEmail ?? emails[0]?.email;
    } catch (error) {
      logger.error("Failed to fetch GitHub user emails", error, profile);
      throwError("Unable to retrieve user email from GitHub", 400);
    }
  }

  if (!email) throwError("No email found for GitHub user", 404);

  const displayName = profile.displayName || profile.username;
  if (!displayName) throwError("No display name found in GitHub profile", 400);

  const oauthUser: IOAuthUser = {
    email,
    service,
    displayName,
    ...(profile.photos?.[0]?.value && { avatarUrl: profile.photos[0].value }),
    provider: AUTH_PROVIDERS.GITHUB,
    isVerified: true,
  };

  return createOAuthUser(oauthUser);
};
