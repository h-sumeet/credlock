import type { NextFunction, Request, Response } from "express";
import {
  archiveUserAccount,
  authenticateUser,
  createUserWithVerification,
  getUserById,
  resetPasswordWithToken,
  sendPasswordResetEmail,
  updateEmailWithVerification,
  updateUserProfile,
  verifyEmailWithToken,
} from "../services/UserService";
import {
  generateTokenPair,
  refreshAccessToken,
  revokeAllUserSessions,
  revokeUserSession,
} from "../services/SessionService";
import { logger } from "../helpers/logger";
import { sendSuccess, throwError } from "../utils/response";
import { serializeUser } from "../helpers/user";
import { isDisposableEmail } from "../services/EmailValidation";
import { HTTP_HEADERS } from "../constants/common";

// User Registration Handler
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, phone, password, redirectUrl } = req.body;

    const isDisposable = await isDisposableEmail(email);
    if (isDisposable) {
      throwError("Please use a valid email address", 400);
    }

    // Create user with verification token
    const { message } = await createUserWithVerification(
      name,
      email,
      phone,
      password,
      redirectUrl
    );

    sendSuccess(res, message);
  } catch (error) {
    logger.error("Registration error", { error, request: req.body });
    next(error);
  }
};

// Verify Email Handler
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;
    const deviceId = req.deviceId;
    if (!deviceId) {
      throwError("DeviceId header is required", 400);
    }
    const { user } = await verifyEmailWithToken(token);

    // Generate tokens for newly verified users
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const tokens = await generateTokenPair(
      user,
      deviceId,
      userAgent,
      ipAddress
    );

    sendSuccess(res, "Email verified successfully", {
      user: serializeUser(user),
      tokens,
    });
  } catch (error) {
    logger.error("Email verification error", { error, user: req.user });
    next(error);
  }
};

// User Login Handler
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.deviceId) {
      throwError("DeviceId header is required", 400);
    }
    const { email, password } = req.body;
    const deviceId = req.deviceId;
    const { user } = await authenticateUser(email, password);

    // Generate tokens
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const tokens = await generateTokenPair(
      user,
      deviceId,
      userAgent,
      ipAddress
    );

    sendSuccess(res, "Login successful", {
      user: serializeUser(user),
      tokens,
    });
  } catch (error) {
    logger.error("User Login error", {
      error,
      user: { ...req.body, ...req.user },
    });
    next(error);
  }
};

// Refresh Token Handler
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.headers[HTTP_HEADERS.REFRESH_TOKEN] as string;
    const deviceId = req.deviceId;
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const tokens = await refreshAccessToken(
      refreshToken,
      deviceId,
      userAgent,
      ipAddress
    );

    sendSuccess(res, "Token refreshed successfully", { tokens });
  } catch (error) {
    logger.error("Token refresh error", { error, user: req.user });
    next(error);
  }
};

// Forgot Password Handler
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, redirectUrl } = req.body;
    await sendPasswordResetEmail(email, redirectUrl);

    sendSuccess(
      res,
      "If an account with that email exists, a password reset link has been sent"
    );
  } catch (error) {
    logger.error("Forgot password error", { error, request: req.body });
    next(error);
  }
};

// Reset Password Handler
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body;
    await resetPasswordWithToken(token, password);

    sendSuccess(
      res,
      "Password reset successful. Please login with your new password."
    );
  } catch (error) {
    logger.error("Reset password error", { error, request: req.body });
    next(error);
  }
};

// Get User Profile Handler
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await getUserById(req.userId);
    sendSuccess(res, "Profile retrieved successfully", {
      user: serializeUser(user),
    });
  } catch (error) {
    logger.error("Get profile error", { error, user: req.user });
    next(error);
  }
};

// Update User Profile Handler
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { user, message } = await updateUserProfile(req.userId, req.body);

    sendSuccess(res, message, { user: serializeUser(user) });
  } catch (error) {
    logger.error("Update profile error", {
      error,
      user: { ...req.body },
    });
    next(error);
  }
};

// Update User Email Handler
export const updateEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, redirectUrl } = req.body;

    const isDisposable = await isDisposableEmail(email);
    if (isDisposable) {
      throwError("Please use a valid email address", 400);
    }

    const { message } = await updateEmailWithVerification(
      req.userId,
      email,
      redirectUrl
    );

    sendSuccess(res, message);
  } catch (error) {
    logger.error("Update email error", {
      error,
      user: { ...req.body, id: req.userId },
    });
    next(error);
  }
};

// Logout Handler
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.deviceId) {
      await revokeUserSession(req.userId, req.deviceId);
    } else {
      await revokeAllUserSessions(req.userId);
    }

    sendSuccess(res, "Logout successful");
  } catch (error) {
    logger.error("Logout error", { error, user: req.user });
    next(error);
  }
};

// Logout All Sessions Handler
export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await revokeAllUserSessions(req.userId);
    sendSuccess(res, "Logged out from all devices successfully");
  } catch (error) {
    logger.error("Logout all error", { error, user: req.user });
    next(error);
  }
};

// Delete Account Handler
export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {message} = await archiveUserAccount(req.userId);
    sendSuccess(res, message);
  } catch (error) {
    logger.error("Error while deleting account ", { error, user: req.user });
    next(error);
  }
};