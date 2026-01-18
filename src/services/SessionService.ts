import { prisma } from "../config/prisma";
import type { TokenPair } from "../types/auth";
import { generateRandomString, hashData } from "../utils/crypto";
import { addDays, currentDate } from "../utils/dayjs";
import { generateAccessToken } from "../helpers/jwt";
import { throwError } from "../utils/response";
import type { User } from "@prisma/client";
import { config } from "../config/app";

/**
 * Create session with refresh token
 */
export const createSession = async (
  user: User,
  deviceId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ refreshToken: string }> => {
  const refreshToken = generateRandomString(40);
  const expiresAt = addDays(parseInt(config.jwt.refreshExpiresIn));

  await prisma.session.upsert({
    where: {
      user_device_id: {
        userId: user.id,
        deviceId: deviceId,
      },
    },
    update: {
      refreshToken: hashData(refreshToken),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
    create: {
      userId: user.id,
      deviceId: deviceId,
      refreshToken: hashData(refreshToken),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  return { refreshToken };
};

/**
 * Generate token pair (access token + refresh token)
 */
export const generateTokenPair = async (
  user: User,
  deviceId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<TokenPair> => {
  const accessToken = generateAccessToken(user);
  const { refreshToken } = await createSession(
    user,
    deviceId,
    userAgent,
    ipAddress
  );
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
  refreshToken: string,
  deviceId?: string,
  userAgent?: string,
  ipAddress?: string
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
  deviceId = deviceId || session.deviceId;
  // Generate new token pair
  return generateTokenPair(
    session.user as User,
    deviceId,
    userAgent,
    ipAddress
  );
};

/**
 * Revoke refresh token (logout)
 */
export const revokeUserSession = async (
  userId: string,
  deviceId: string
): Promise<void> => {
  await prisma.session.deleteMany({
    where: {
      userId,
      deviceId,
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
