import { config } from "../config/app";
import { prisma } from "../config/prisma";
import type {
  AccountLockoutInfo,
  EmailInfo,
  PasswordInfo,
  PhoneInfo,
  User,
} from "@prisma/client";
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
import type {
  MongoRawCommandResult,
  UpdateUserProfile,
  UserExistsResult,
} from "../types/user";
import { logger } from "../helpers/logger";

// Check if a user exists by email or phone, excluding a specific user ID if provided
export const checkUserExists = async (
  email?: string,
  phone?: string,
  service?: string,
  userId?: string
): Promise<UserExistsResult> => {
  const orConditions = [];

  if (email && service) {
    orConditions.push({ email, service });
  }

  if (phone && service) {
    orConditions.push({ phone, service });
  }

  // If no email or phone provided, return false
  if (orConditions.length === 0) {
    return { exists: false };
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: orConditions,
      ...(userId && { id: { not: userId } }),
    },
  });

  if (!existingUser) {
    return { exists: false };
  }

  const field = existingUser.email === email ? "email" : "phone";

  return { exists: true, user: existingUser, field };
};

// Delete an unverified user by ID
export const deleteUnverifiedUser = async (userId: string): Promise<void> => {
  const result = await prisma.user.deleteMany({
    where: {
      id: userId,
      emailInfo: {
        is: {
          isVerified: false,
        },
      },
    },
  });

  if (result.count === 0) {
    throwError("User not found or already verified", 404);
  }
};

// Create a new user with email verification token
export const createUserWithVerification = async (
  fullname: string,
  email: string,
  phone: string | undefined,
  password: string,
  service: string
): Promise<{ user: User; verificationToken: string }> => {
  const hashedPassword = await hashPassword(password);
  const { token, hashed, expires } = generateVerificationToken(1, "days");

  const user = await prisma.user.create({
    data: {
      fullname,
      email,
      service,
      ...(phone && { phone }),
      passwordInfo: {
        hash: hashedPassword,
      },
      emailInfo: {
        isVerified: false,
        verificationToken: hashed,
        verificationExpires: expires,
      },
      ...(phone && {
        phoneInfo: {
          isVerified: false,
        },
      }),
      lockoutInfo: {
        isLocked: false,
        failedAttemptCount: 0,
      },
    },
  });

  return { user, verificationToken: token };
};

// Send email verification email
export const sendEmailVerification = async (
  email: string,
  fullname: string,
  verificationToken: string,
  redirectUrl: string,
  isEmailChange: boolean = false
): Promise<void> => {
  const emailTemplate = await generateEmailVerificationTemplate(
    fullname,
    verificationToken,
    redirectUrl,
    isEmailChange
  );
  await sendEmail(email, emailTemplate);
};

// Verify email using a verification token and update verification status
export const verifyEmailWithToken = async (
  token: string
): Promise<{ user: User; isNewlyVerified: boolean }> => {
  const hashedToken = hashData(token);

  // Use raw MongoDB query for nested composite type field
  const result = await prisma.$runCommandRaw({
    find: "users",
    filter: {
      $expr: {
        $and: [
          { $eq: ["$emailInfo.verificationToken", hashedToken] },
          { $gt: ["$emailInfo.verificationExpires", currentDate()] },
        ],
      },
    },
    limit: 1,
  });

  const userDoc = (result as MongoRawCommandResult).cursor?.firstBatch?.[0];

  if (!userDoc) throwError("Invalid or expired email verification token", 403);

  const userId =
    typeof userDoc._id === "string" ? userDoc._id : userDoc._id.$oid;
  const emailInfo = userDoc["emailInfo"] as EmailInfo;
  const isNewlyVerified = !emailInfo.isVerified;
  const pendingEmail = emailInfo.pendingEmail;

  // Handle email change verification
  if (pendingEmail) {
    const emailTaken = await prisma.user.findFirst({
      where: {
        email: pendingEmail,
        id: { not: userId },
      },
    });

    if (emailTaken) {
      throwError("Email address is already in use", 409);
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(pendingEmail && { email: pendingEmail }),
      emailInfo: {
        isVerified: true,
        provider: emailInfo.provider,
        verificationToken: null,
        verificationExpires: null,
        pendingEmail: null,
      },
    },
  });

  logger.info("Email verified successfully", {
    userId,
    email: updatedUser.email,
    isNewlyVerified,
    wasEmailChange: !!pendingEmail,
  });

  return {
    user: updatedUser!,
    isNewlyVerified,
  };
};

// Authenticate a user with email and password
export const authenticateUser = async (
  email: string,
  password: string,
  service: string
): Promise<{ user: User | null; isValid: boolean }> => {
  const user = await prisma.user.findFirst({
    where: {
      email,
      service,
    },
  });

  // User not found
  if (!user) {
    return { user: null, isValid: false };
  }

  const emailInfo = user.emailInfo as EmailInfo;
  const passwordData = user.passwordInfo as PasswordInfo;

  if (emailInfo.provider && !passwordData.hash) {
    throwError(
      "You signed in with a social account. To log in with a password, please set one using 'Forgot Password'.",
      403
    );
  }

  // Email not verified
  if (!emailInfo.isVerified) {
    throwError("Please verify your email before logging in", 403);
  }

  // Account is locked
  if (isAccountLocked(user)) {
    throwError(
      "Account is temporarily locked due to multiple failed login attempts",
      423
    );
  }

  // Password does not match
  if (!(await comparePassword(user.passwordInfo?.hash, password))) {
    await incrementFailedLoginAttempts(user);
    return { user, isValid: false };
  }

  // Reset failed login attempts
  const lockout = user.lockoutInfo as AccountLockoutInfo;
  if (lockout.failedAttemptCount > 0) {
    await resetFailedLoginAttempts(user.id);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: currentDate() },
  });

  return { user, isValid: true };
};

// Increment the count of failed login attempts and lock account if needed
export const incrementFailedLoginAttempts = async (
  user: User
): Promise<void> => {
  const { maxLoginAttempts, loginLockTime } = config.security;

  const lockout = user.lockoutInfo as AccountLockoutInfo;
  const newAttempts = lockout.failedAttemptCount + 1;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lockoutInfo: {
        failedAttemptCount: newAttempts,
        isLocked: newAttempts >= maxLoginAttempts,
        ...(newAttempts >= maxLoginAttempts && {
          lockedUntil: addMinutes(loginLockTime),
        }),
      },
    },
  });
};

// Reset failed login attempts and unlock the account
export const resetFailedLoginAttempts = async (
  userId: string
): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lockoutInfo: {
        failedAttemptCount: 0,
        isLocked: false,
        lockedUntil: null,
      },
    },
  });
};

// Send password reset email with a reset token and redirect URL
export const sendPasswordResetEmail = async (
  email: string,
  redirectUrl: string,
  service: string
): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: {
      email,
      service,
    },
  });
  if (!user) return;

  const resetToken = generateRandomString(32);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordInfo: {
        ...(user.passwordInfo as PasswordInfo),
        resetToken: hashData(resetToken),
        resetExpires: addMinutes(30),
      },
    },
  });

  const emailTemplate = await generatePasswordResetTemplate(
    user.fullname,
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

  const result = await prisma.$runCommandRaw({
    find: "users",
    filter: {
      $expr: {
        $and: [
          { $eq: ["$passwordInfo.resetToken", hashedToken] },
          { $gt: ["$passwordInfo.resetExpires", currentDate()] },
        ],
      },
    },
    limit: 1,
  });

  const userDoc = (result as MongoRawCommandResult).cursor?.firstBatch?.[0];

  if (!userDoc) throwError("Invalid or expired password reset token");

  const userId =
    typeof userDoc._id === "string" ? userDoc._id : userDoc._id.$oid;
  const hashedPassword = await hashPassword(newPassword);
  const passwordInfo = userDoc["passwordInfo"] as PasswordInfo;
  const lockoutInfo = userDoc["lockoutInfo"] as AccountLockoutInfo;
  const emailInfo = userDoc["emailInfo"] as EmailInfo;

  const isAccountLocked = lockoutInfo.isLocked;
  const isEmailUnverified = !emailInfo.isVerified;

  // Update user: reset password, unlock account if needed, verify email if needed
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordInfo: {
        ...passwordInfo,
        hash: hashedPassword,
        resetToken: null,
        resetExpires: null,
      },
      lockoutInfo: {
        ...lockoutInfo,
        ...(isAccountLocked && {
          isLocked: false,
          lockedUntil: null,
          failedAttemptCount: 0,
        }),
      },
      emailInfo: {
        ...emailInfo,
        ...(isEmailUnverified && {
          isVerified: true,
          verificationToken: null,
          verificationExpires: null,
        }),
      },
    },
  });

  // Revoke all user sessions
  await revokeAllUserSessions(userId);
};

// Update user profile
export const updateUserProfile = async (
  user: User,
  updates: UpdateUserProfile
): Promise<{ user: User; message: string }> => {
  const { fullname, phone, email, password, redirectUrl } = updates;

  const emailInfo = user.emailInfo as EmailInfo;
  const passwordInfo = user.passwordInfo as PasswordInfo;
  let message: string = "Profile updated successfully";
  let updatedUser = user;

  // Validate email/phone availability
  if (email || phone) {
    const userExists = await checkUserExists(
      email,
      phone,
      user.service,
      user.id
    );
    if (userExists.exists) {
      const existingUser = userExists.user;
      const emailInfo = existingUser.emailInfo as EmailInfo;
      if (emailInfo.isVerified) {
        throwError(
          userExists.field === "email"
            ? "Email is already taken"
            : "Phone number is already taken",
          409
        );
      } else {
        await deleteUnverifiedUser(existingUser.id);
      }
    }
  }

  // Handle email update with verification workflow
  if (email && email !== user.email) {
    // Generate email verification token
    const { token, hashed, expires } = generateVerificationToken(1, "days");

    try {
      // Update user with pending email and verification token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailInfo: {
            ...emailInfo,
            pendingEmail: email,
            verificationToken: hashed,
            verificationExpires: expires,
          },
        },
      });

      // Send verification email to new email address
      await sendEmailVerification(
        email,
        user.fullname,
        token,
        redirectUrl!,
        true
      );

      message =
        "Profile updated. Verification email sent to your new email address. Please verify to complete the email change.";
    } catch (error) {
      // Rollback pending email on email send failure
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailInfo: {
            ...emailInfo,
            pendingEmail: null,
            verificationToken: null,
            verificationExpires: null,
          },
        },
      });

      throw error;
    }
  }

  // Prepare update data for other fields
  const updateData: {
    fullname?: string;
    phoneInfo?: PhoneInfo;
    passwordInfo?: PasswordInfo;
  } = {};

  // Update fullname
  if (fullname) {
    updateData.fullname = fullname;
  }

  // TODO: Update phone number with verification workflow

  // Update password
  if (password) {
    const hashedPassword = await hashPassword(password);

    updateData.passwordInfo = {
      ...passwordInfo,
      hash: hashedPassword,
    };

    message = "Password updated successfully";
  }

  // Apply all updates if any exist
  if (Object.keys(updateData).length > 0) {
    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  return { user: updatedUser, message };
};
