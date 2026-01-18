import { config } from "../config/app";
import { prisma } from "../config/prisma";
import { generateRandomString, hashData } from "../utils/crypto";
import { addMinutes, currentDate } from "../utils/dayjs";
import { throwError } from "../utils/response";
import { sendEmail } from "./EmailService";
import { revokeAllUserSessions } from "./SessionService";
import {
  comparePassword,
  generateVerificationToken,
  hashPassword,
  isAccountLocked,
} from "../helpers/user";
import {
  generateEmailVerificationTemplate,
  generatePasswordResetTemplate,
} from "../templates/emailTemplates";
import type { UpdateUserProfile, UserExistsResult } from "../types/user";
import type { User } from "@prisma/client";
import {
  EMAIL_TOKEN_EXPIRY_IN_MINUTES,
  PASSWORD_TOKEN_EXPIRY_IN_MINUTES,
} from "../constants/common";

// Check if a user exists by email or phone, excluding a specific user ID if provided
export const checkUserExists = async (
  email: string,
): Promise<UserExistsResult> => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { emailInfo: true },
  });

  if (existingUser) {
    if (
      existingUser.emailInfo &&
      existingUser.emailInfo.isVerified
    ) {
      return {
        exists: true,
        user: existingUser as User,
      };
    } else {
      // delete unverified user.
      await deleteUserById(existingUser.id);
      return { exists: false };
    }
  }

  return { exists: false };
};

// Delete an user by ID
export const deleteUserById = async (userId: string): Promise<void> => {
  // Delete user (cascade will handle related records)
  await prisma.user.delete({
    where: { id: userId },
  });
};

// Get user by userId
export const getUserById = async (userId: string): Promise<User> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throwError("User not found", 404);
  }

  return user;
};

// Create a new user with email verification token
export const createUserWithVerification = async (
  name: string,
  email: string,
  phone: string | undefined,
  password: string,
  redirectUrl: string
): Promise<{ message: string }> => {
  const userExists = await checkUserExists(email);
  if (userExists.exists) {
    throwError("User with this email already exists");
  }

  const hashedPassword = await hashPassword(password);
  const { token, hashed, expires } = generateVerificationToken(
    EMAIL_TOKEN_EXPIRY_IN_MINUTES
  );

  await prisma.user.create({
    data: {
      name,
      email,
      ...(phone && { phone }),
      emailInfo: {
        create: {
          token: hashed,
          tokenExpires: expires,
        },
      },
      passwordInfo: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  const emailTemplate = await generateEmailVerificationTemplate(
    name,
    token,
    redirectUrl,
    false
  );
  await sendEmail(email, emailTemplate);

  return {
    message:
      "User registered successfully. Please check your email for verification.",
  };
};

// Verify email using a verification token and update verification status
export const verifyEmailWithToken = async (
  token: string
): Promise<{ user: User }> => {
  const hashedToken = hashData(token);

  // Find user by verification token using standard Prisma query
  const emailInfo = await prisma.emailInfo.findFirst({
    where: {
      token: hashedToken,
      tokenExpires: { gt: currentDate() },
    },
  });

  if (!emailInfo) {
    throwError("Invalid or expired email verification token", 403);
  }

  const userId = emailInfo.userId;
  const emailInfoId = emailInfo.id;

  // Update user's email to pending email if exists
  if (emailInfo.pendingEmail) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: emailInfo.pendingEmail,
      },
    });
  }

  await prisma.emailInfo.update({
    where: { id: emailInfoId },
    data: {
      isVerified: true,
      token: null,
      tokenExpires: null,
    },
  });

  const user = await getUserById(userId);

  return { user };
};

// Authenticate a user with email and password
export const authenticateUser = async (
  email: string,
  password: string,
): Promise<{ user: User }> => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      provider: true,
      passwordInfo: {
        select: { hash: true },
      },
      lockoutInfo: {
        select: { lockedUntil: true, failedAttemptCount: true },
      },
      emailInfo: {
        select: { isVerified: true },
      },
    },
  });

  // User not found
  if (!user) {
    throwError("Invalid email or password!", 401);
  }

  if (user.emailInfo && !user.emailInfo.isVerified) {
    throwError("Please verify your email before logging in", 403);
  }

  if (user.lockoutInfo && isAccountLocked(user.lockoutInfo.lockedUntil)) {
    throwError(
      "This account is locked due to multiple failed login attempts. Please try again later or reset your password.",
      403
    );
  }

  const passwordData = user.passwordInfo;
  if (user.provider && !passwordData?.hash) {
    throwError(
      `This account is linked to ${user.provider}. Please sign in using ${user.provider}, or set a password using 'Forgot Password' to enable password login.`,
      403
    );
  }

  // Password does not match
  if (!(await comparePassword(passwordData?.hash ?? null, password))) {
    incrementFailedLoginAttempts(user.id);
    throwError("Invalid email or password!", 401);
  }

  // Reset failed login attempts on successful login
  if (user.lockoutInfo) {
    resetFailedLoginAttempts(user.id);
  }

  // Update last login timestamp (non blocking action)
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: currentDate(),
    },
  });

  return { user: updatedUser };
};

// Increment failed login attempt
export const incrementFailedLoginAttempts = async (
  userId: string
): Promise<void> => {
  const lockoutInfo = await prisma.lockoutInfo.findUnique({
    where: { userId: userId },
  });

  const failedAttemptCount = lockoutInfo
    ? lockoutInfo.failedAttemptCount + 1
    : 1;
  const isLocked = config.security.maxLoginAttempts <= failedAttemptCount;

  await prisma.lockoutInfo.upsert({
    where: { userId },
    update: {
      failedAttemptCount: failedAttemptCount,
      lockedUntil: isLocked ? addMinutes(config.security.loginLockTime) : null,
    },
    create: {
      userId: userId,
      failedAttemptCount: failedAttemptCount,
      lockedUntil: isLocked ? addMinutes(config.security.loginLockTime) : null,
    },
  });
};

// Reset failed login attempts and unlock the account
export const resetFailedLoginAttempts = async (
  userId: string
): Promise<void> => {
  await prisma.lockoutInfo.deleteMany({
    where: { userId: userId },
  });
};

// Send password reset email with a reset token and redirect URL
export const sendPasswordResetEmail = async (
  email: string,
  redirectUrl: string,
): Promise<void> => {
  const existingUser = await checkUserExists(email);

  if (!existingUser.exists) {
    throwError("Don't have an account with that email", 404);
  }

  const user = existingUser.user;
  const resetToken = generateRandomString(32);
  const hashedResetToken = hashData(resetToken);

  await prisma.passwordInfo.upsert({
    where: { userId: user.id },
    update: {
      token: hashedResetToken,
      tokenExpires: addMinutes(PASSWORD_TOKEN_EXPIRY_IN_MINUTES),
    },
    create: {
      userId: user.id,
      token: hashedResetToken,
      tokenExpires: addMinutes(PASSWORD_TOKEN_EXPIRY_IN_MINUTES),
    },
  });

  const emailTemplate = await generatePasswordResetTemplate(
    user.name,
    resetToken,
    redirectUrl
  );

  await sendEmail(email, emailTemplate);
};

// Reset user password using a valid reset token
export const resetPasswordWithToken = async (
  token: string,
  newPassword: string
): Promise<void> => {
  const hashedToken = hashData(token);

  // Find password info by reset token
  const passwordInfo = await prisma.passwordInfo.findFirst({
    where: {
      token: hashedToken,
      tokenExpires: { gt: currentDate() },
    },
  });

  if (!passwordInfo) {
    throwError("Invalid or expired password reset token");
  }

  const userId = passwordInfo.userId;
  const hashedPassword = await hashPassword(newPassword);

  // Update password info
  await prisma.passwordInfo.update({
    where: { userId: userId },
    data: {
      hash: hashedPassword,
      token: null,
      tokenExpires: null,
    },
  });

  // Revoke all user sessions and reset failed login attempts
  await resetFailedLoginAttempts(userId);
  await revokeAllUserSessions(userId);
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  updates: UpdateUserProfile
): Promise<{ user: User; message: string }> => {
  const { name, phone, password } = updates;

  // Hash password if provided
  const hashedPassword = password ? await hashPassword(password) : undefined;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(hashedPassword && {
        passwordInfo: {
          update: {
            hash: hashedPassword,
          },
        },
      }),
    },
    include: {
      passwordInfo: true,
    },
  });

  // Revoke all sessions if password was changed
  if (hashedPassword) {
    await revokeAllUserSessions(userId);
  }

  return {
    user,
    message: hashedPassword
      ? "Profile updated successfully. Please login again with your new password."
      : "Profile updated successfully",
  };
};

export const updateEmailWithVerification = async (
  userId: string,
  newEmail: string,
  redirectUrl: string
): Promise<{ message: string }> => {
  // Check if email already exists for the same service
  const user = await getUserById(userId);

  const existingUser = await checkUserExists(newEmail);
  if (existingUser.exists) {
    throwError("Email already in use", 409);
  }

  // Generate verification token
  const { token, hashed, expires } = generateVerificationToken(
    EMAIL_TOKEN_EXPIRY_IN_MINUTES
  );

  // Update emailInfo with pending email and new verification token
  await prisma.emailInfo.upsert({
    where: { userId },
    update: {
      pendingEmail: newEmail.trim(),
      token: hashed,
      tokenExpires: expires,
    },
    create: {
      userId,
      pendingEmail: newEmail.trim(),
      token: hashed,
      tokenExpires: expires,
      isVerified: false,
    },
  });

  // Send verification email to new address
  const emailTemplate = await generateEmailVerificationTemplate(
    user.name,
    token,
    redirectUrl,
    true
  );
  await sendEmail(newEmail, emailTemplate);

  return {
    message: "Verification email sent to new email address",
  };
};

// Archive user account by moving data to InactiveUser and deleting original user
export const archiveUserAccount = async (userId: string): Promise<{ message: string }> => {
  const user = await getUserById(userId);

  await prisma.$transaction(async (tx) => {
    await tx.inactiveUser.create({
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        provider: user.provider,
        lastLoginAt: user.lastLoginAt,
        accountUpdatedAt: user.updatedAt,
        accountCreatedAt: user.createdAt,
      },
    });

    await tx.session.deleteMany({
      where: { userId: user.id },
    });

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  return { message: "Account deleted successfully" };
};