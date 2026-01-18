import type { Request, Response, NextFunction } from "express";
import { throwError } from "../utils/response";
import { verifyAccessToken } from "../helpers/jwt";
import { HTTP_HEADERS } from "../constants/common";

/**
 * Middleware to authenticate access and refresh tokens
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accessToken = req.headers[HTTP_HEADERS.AUTHORIZATION] as string;
    const deviceId = req.headers[HTTP_HEADERS.DEVICE_ID] as string;
    if (!accessToken || !accessToken.startsWith("Bearer ")) {
      throwError("Access token and refresh token are required", 401);
    }

    const token = accessToken.substring(7).trim();
    const payload = verifyAccessToken(token);
    if (!payload.userId)
      throwError("Invalid token payload", 401);

    req.userId = payload.userId;
    req.deviceId = deviceId;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to extract and validate service header
 */
export const clientContext = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const deviceId = req.headers[HTTP_HEADERS.DEVICE_ID] as string;

    req.deviceId = deviceId;
    next();
  } catch (error) {
    next(error);
  }
};
