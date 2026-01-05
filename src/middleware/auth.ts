import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { hashData } from "../utils/crypto";
import { currentDate } from "../utils/dayjs";
import { throwError } from "../utils/response";
import { isAccountLocked } from "../helpers/user";
import { verifyAccessToken } from "../helpers/jwt";
import { HTTP_HEADERS } from "../constants/common";
import type { UserDetails } from "../types/user";

// Include options for user queries with relations
const userInclude = {
  emailInfo: true,
  phoneInfo: true,
  passwordInfo: true,
  lockoutInfo: true,
} as const;

/**
 * Middleware to authenticate access and refresh tokens
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accessToken = req.headers[HTTP_HEADERS.AUTHORIZATION] as string;
    const refreshToken = req.headers[HTTP_HEADERS.REFRESH_TOKEN] as string;
    const serviceId = req.headers[HTTP_HEADERS.SERVICE_ID] as string;

    if (!accessToken || !accessToken.startsWith("Bearer ")) {
      throwError("Authorization token is required", 401);
    }

    if (!refreshToken) {
      throwError("Refresh token is required", 400);
    }

    if (!serviceId) {
      throwError("Service ID is required", 400);
    }

    const token = accessToken.substring(7).trim();
    const payload = verifyAccessToken(token);

    if (!payload.userId || !payload.email || !payload.serviceId)
      throwError("Invalid token payload", 401);

    // Validate service from header matches service in token
    if (serviceId && serviceId !== payload.serviceId) {
      throwError("Service mismatch", 403);
    }

    // Check if user session exists and is not expired
    const activeSession = await prisma.session.findFirst({
      where: {
        refreshToken: hashData(refreshToken),
        expiresAt: { gt: currentDate() },
      },
    });

    if (!activeSession) throwError("Invalid or expired refresh token", 401);

    // Get user from database with service validation
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        service: payload.serviceId,
      },
      include: userInclude,
    });

    // Check if user exists
    if (!user) throwError("User not found", 401);

    const userDetails = user as UserDetails;

    // Check if user account is locked
    if (isAccountLocked(userDetails))
      throwError(
        "Account is locked due to multiple failed login attempts",
        423
      );

    // Attach user, JWT payload, and service to request
    req.user = userDetails;
    req.jwt = payload;
    req.serviceId = payload.serviceId;

    next();
  } catch (error) {
    next(error);
  }
};
