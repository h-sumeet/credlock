import { prisma } from "../config/prisma";
import type { TokenPair } from "../types/auth";
import { config } from "../config/app";
import { generateRandomString, hashData } from "../utils/crypto";
import { addDays, currentDate } from "../utils/dayjs";
import { generateAccessToken } from "../helpers/jwt";
import { throwError } from "../utils/response";
import type { Session, User } from "@prisma/client";

/**
 * Create session with refresh token
 */
export const createSession = async (
  user: User,
  userAgent?: string,
  ipAddress?: string
): Promise<{ session: Session; refreshToken: string }> => {
  const refreshToken = generateRandomString(40);
  const expiresAt = addDays(parseInt(config.jwt.refreshExpiresIn));

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: hashData(refreshToken),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  return {
    session,
    refreshToken,
  };
};

/**
 * Generate token pair (access token + refresh token)
 */
export const generateTokenPair = async (
  user: User,
  userAgent?: string,
  ipAddress?: string
): Promise<TokenPair> => {
  const accessToken = generateAccessToken(user);
  const { refreshToken } = await createSession(user, userAgent, ipAddress);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
  };
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<TokenPair> => {
  const hashedRefreshToken = hashData(refreshToken);

  const session = await prisma.session.findFirst({
    where: {
      refreshToken: hashedRefreshToken,
      expiresAt: { gt: currentDate() },
    },
    include: {
      user: true,
    },
  });

  if (!session) throwError("Invalid or expired refresh token");
  if (!session.user) throwError("User not found");

  // Delete the old session
  await revokeRefreshToken(refreshToken);
  // Generate new token pair
  return generateTokenPair(session.user);
};

/**
 * Revoke refresh token (logout)
 */
export const revokeRefreshToken = async (
  refreshToken: string
): Promise<void> => {
  const hashedRefreshToken = hashData(refreshToken);
  await prisma.session.delete({
    where: {
      refreshToken: hashedRefreshToken,
    },
  });
};

/**
 * Revoke all user sessions (logout from all devices)
 */
export const revokeAllUserSessions = async (userId: string): Promise<void> => {
  await prisma.session.deleteMany({
    where: {
      userId,
    },
  });
};
