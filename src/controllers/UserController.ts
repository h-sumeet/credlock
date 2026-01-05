import type { NextFunction, Request, Response } from "express";
import {
  authenticateUser,
  checkUserExists,
  createUserWithVerification,
  deleteUnverifiedUser,
  resetPasswordWithToken,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateUserProfile,
  verifyEmailWithToken,
} from "../services/UserService";
import {
  generateTokenPair,
  refreshAccessToken,
  revokeAllUserSessions,
  revokeRefreshToken,
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
    const { fullname, email, phone, password, redirectUrl } = req.body;
    const serviceId = req.serviceId!;

    const isDisposable = await isDisposableEmail(email);
    if (isDisposable) {
      throwError("Please use a valid email address", 400);
    }

    // Check if user with email or phone already exists
    const userExists = await checkUserExists(email, phone, serviceId);

    if (userExists.exists) {
      const existingUser = userExists.user;
      const emailInfo = existingUser.emailInfo;

      if (emailInfo.isVerified) {
        throwError(
          userExists.field === "email"
            ? "User with this email already exists"
            : "User with this phone number already exists",
          409
        );
      } else {
        await deleteUnverifiedUser(existingUser.id);
      }

    }

    // Create user with verification token
    const { user, verificationToken } = await createUserWithVerification(
      fullname,
      email,
      phone,
      password,
      serviceId
    );

    // Send verification email (non-blocking)
    sendEmailVerification(
      email,
      fullname,
      verificationToken,
      redirectUrl
    ).catch((error) => {
      logger.error("Failed to send verification email", {
        error,
        userId: user.id,
      });
    });

    sendSuccess(
      res,
      "User registered successfully. Please check your email for verification."
    );
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
    const { user, isNewlyVerified } = await verifyEmailWithToken(token);

    // Generate tokens for newly verified users
    let tokens = null;
    if (isNewlyVerified) {
      const userAgent = req.headers["user-agent"];
      const ipAddress = req.ip || req.socket?.remoteAddress;
      tokens = await generateTokenPair(user, userAgent, ipAddress);
    }

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
    const { email, password } = req.body;
    const serviceId = req.serviceId!;
    const { user, isValid } = await authenticateUser(email, password, serviceId);

    if (!isValid || !user) throwError("Invalid email or password!", 401);

    // Generate tokens
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const tokens = await generateTokenPair(user, userAgent, ipAddress);

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
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const tokens = await refreshAccessToken(refreshToken, userAgent, ipAddress);

    sendSuccess(res, "Token refreshed successfully", { tokens });
  } catch (error) {
    logger.error("Token refresh error", { error, user: req.user });
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
    sendSuccess(res, "Profile retrieved successfully", {
      user: serializeUser(req.user!),
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
    const { user, message } = await updateUserProfile(req.user!, req.body);

    sendSuccess(res, message, { user: serializeUser(user) });
  } catch (error) {
    logger.error("Update profile error", {
      error,
      user: { ...req.body },
    });
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
    const serviceId = req.serviceId!;
    await sendPasswordResetEmail(email, redirectUrl, serviceId);

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

// Logout Handler
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.headers["x-refresh-token"];

    if (refreshToken) {
      await revokeRefreshToken(refreshToken as string);
    } else if (req.user) {
      // Delete the current user's most recent active session
      await revokeAllUserSessions(req.user.id);
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
    await revokeAllUserSessions(req.user!.id);
    sendSuccess(res, "Logged out from all devices successfully");
  } catch (error) {
    logger.error("Logout all error", { error, user: req.user });
    next(error);
  }
};
