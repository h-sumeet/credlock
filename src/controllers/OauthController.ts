import type { NextFunction, Request, Response } from "express";
import passport from "passport";
import { generateTokenPair } from "../services/SessionService";
import { logger } from "../helpers/logger";
import { sendSuccess, throwError } from "../utils/response";
import { generateRandomString } from "../utils/crypto";
import { currentDate, addMinutes } from "../utils/dayjs";
import { LOGIN_CODE_EXPIRY_MINUTES, SERVICES } from "../constants/common";
import type { IOAuthUser, LoginStoreRecord } from "../types/user";
import type { TokenPair } from "../types/auth";
import type { User } from "@prisma/client";
import { serializeUser } from "../helpers/user";

// In-memory login store with auto-expiry handling
const createLoginStore = () => {
  const store = new Map<string, LoginStoreRecord>();

  // Store login code with associated user and tokens
  const set = (code: string, user: User, tokens: TokenPair) =>
    store.set(code, {
      user,
      tokens,
      expiresAt: addMinutes(LOGIN_CODE_EXPIRY_MINUTES).getTime(),
    });

  // Retrieve valid record or return null if expired/missing
  const get = (code: string): LoginStoreRecord | null => {
    const record = store.get(code);
    if (!record) return null;
    if (record.expiresAt < currentDate().getTime()) {
      store.delete(code);
      return null;
    }
    return record;
  };

  // Delete record from store
  const del = (code: string) => store.delete(code);

  // Periodically remove expired entries
  const cleanup = () => {
    const now = currentDate().getTime();
    for (const [code, { expiresAt }] of store.entries()) {
      if (expiresAt < now) store.delete(code);
    }
  };

  setInterval(cleanup, 60 * 1000).unref(); // Run cleanup every minute

  return { set, get, delete: del };
};

const loginStore = createLoginStore();

// OAuth provider middleware initializer
const authProvider =
  (provider: IOAuthUser["provider"], options: Record<string, unknown> = {}) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const redirectUrl = req.query["redirectUrl"] as string; // exchange-code endpoint of frontend
      const nextUrl = req.query["nextUrl"] as string | undefined; // redirect after login
      const service = req.query["service"] as string; // service from query params

      if (!redirectUrl) throwError("Missing redirectUrl", 400);
      if (!service) throwError("Missing service parameter", 400);

      // Validate service
      const validServices = Object.values(SERVICES) as string[];
      if (!validServices.includes(service)) {
        throwError(
          `Invalid service. Allowed services: ${validServices.join(", ")}`,
          400
        );
      }

      const state = JSON.stringify({
        redirectUrl,
        nextUrl,
        service,
      });

      passport.authenticate(provider, {
        ...options,
        state, // redirect URL and service passed as state
      })(req, res, next);
    } catch (error) {
      logger.error(`${provider} authentication error`, { error });
      next(error);
    }
  };

// Common callback handler for all OAuth providers
const handleOAuthCallback = async (
  req: Request,
  res: Response,
  next: NextFunction,
  provider: string
) => {
  try {
    if (!req.user) throwError("User not authenticated", 401);

    // Generate access/refresh tokens
    const tokens = await generateTokenPair(
      req.user,
      req.headers["user-agent"],
      req.ip || req.socket?.remoteAddress
    );

    const stateParam = req.query["state"] as string;
    if (!stateParam) {
      throwError("Missing state parameter", 400);
    }
    const { redirectUrl, nextUrl } = JSON.parse(stateParam);

    const code = generateRandomString(); // Temporary login code
    loginStore.set(code, req.user, tokens); // Save login session

    const url = new URL(redirectUrl);
    url.searchParams.set("code", code);
    if (nextUrl) {
      url.searchParams.set("redirectUrl", nextUrl);
    }

    res.redirect(url.toString()); // Redirect with login code and nextUrl
  } catch (error) {
    logger.error(`${provider} callback error`, { error, user: req.user });
    next(error);
  }
};

// Google OAuth endpoints
export const googleAuth = authProvider("google", {
  scope: ["profile", "email"],
  accessType: "offline",
  prompt: "select_account",
});

// Google OAuth callback
export const googleCallback = (
  req: Request,
  res: Response,
  next: NextFunction
) => handleOAuthCallback(req, res, next, "Google");

// GitHub OAuth endpoints
export const githubAuth = authProvider("github", {
  scope: ["user:email"],
});

// GitHub OAuth callback
export const githubCallback = (
  req: Request,
  res: Response,
  next: NextFunction
) => handleOAuthCallback(req, res, next, "GitHub");

// Exchange login code for tokens
export const exchangeCode = (req: Request, res: Response): void => {
  const code = req.query["code"] as string;
  if (!code) throwError("Missing login code", 400);

  const record = loginStore.get(code);
  if (!record) throwError("Invalid or expired login code", 400);

  loginStore.delete(code); // Invalidate code after use

  sendSuccess(res, "Login successful", {
    user: serializeUser(record.user),
    tokens: record.tokens,
  });
};

/*
OAuth flow:
User → Passport → OAuth Provider
OAuth Provider → Passport (user saved)
Passport → Controller → Response to frontend
*/
