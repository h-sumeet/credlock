import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { hashData } from "../utils/crypto";
import { currentDate } from "../utils/dayjs";
import { throwError } from "../utils/response";
import { isAccountLocked } from "../helpers/user";
import { verifyAccessToken } from "../helpers/jwt";
import { CUSTOM_HEADERS } from "../constants/common";

/**
 * Middleware to authenticate access and refresh tokens
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accessToken = req.headers["authorization"]!.substring(7).trim();
    const refreshToken = req.headers[CUSTOM_HEADERS.REFRESH_TOKEN] as string;
    const service = req.headers[CUSTOM_HEADERS.SERVICE_HEADER] as string;
    const payload = verifyAccessToken(accessToken);

    if (!payload.userId || !payload.email || !payload.service)
      throwError("Invalid token payload", 401);

    // Validate service from header matches service in token
    if (service && service !== payload.service) {
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
        service: payload.service,
      },
    });

    // Check if user exists
    if (!user) throwError("User not found", 401);

    // Check if user account is locked
    if (isAccountLocked(user))
      throwError(
        "Account is locked due to multiple failed login attempts",
        423
      );

    // Attach user, JWT payload, and service to request
    req.user = user;
    req.jwt = payload;
    req.service = payload.service;

    next();
  } catch (error) {
    next(error);
  }
};
