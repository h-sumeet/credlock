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
import type {
  UpdateUserProfile,
  UserExistsResult,
  UserDetails,
} from "../types/user";
import { logger } from "../helpers/logger";

// Include options for user queries with relations
const userInclude = {
  emailInfo: true,
  phoneInfo: true,
  passwordInfo: true,
  lockoutInfo: true,
} as const;

// Check if a user exists by email or phone, excluding a specific user ID if provided
export const checkUserExists = async (
  email?: string,
  phone?: string,
  service?: string,
  userId?: string
): Promise<UserExistsResult> => {
  if (email && service) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email_service_id: {
          email: email.trim(),
          serviceId: service,
        },
      },
      include: userInclude,
    });

    if (existingUser) {
      return {
        exists: true,
        user: existingUser as UserDetails,
        field: "email",
      };
    }
  }

  if (phone && service) {
    // TODO: Add unique constraint for phone + service in the database for efficiency
  }

  return { exists: false };
};

// Delete an unverified user by ID
export const deleteUnverifiedUser = async (userId: string): Promise<void> => {
  // Delete user (cascade will handle related records)
  await prisma.user.delete({
    where: { id: userId },
  });
};

// Create a new user with email verification token
export const createUserWithVerification = async (
  fullname: string,
  email: string,
  phone: string | undefined,
  password: string,
  serviceId: string
): Promise<{ user: UserDetails; verificationToken: string }> => {
  const hashedPassword = await hashPassword(password);
  const { token, hashed, expires } = generateVerificationToken(1, "days");

  const user = await prisma.user.create({
    data: {
      fullName: fullname,
      email,
      serviceId,
      ...(phone && { phone }),
      emailInfo: {
        create: {
          isVerified: false,
          verificationToken: hashed,
          verificationExpires: expires,
        },
      },
      passwordInfo: {
        create: {
          hash: hashedPassword,
        },
      },
      ...(phone && {
        phone_info: {
          create: {
            is_verified: false,
          },
        },
      }),
      lockoutInfo: {
        create: {
          isLocked: false,
          failedAttemptCount: 0,
        },
      },
    },
    include: userInclude,
  });

  return { user: user as UserDetails, verificationToken: token };
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
): Promise<{ user: UserDetails; isNewlyVerified: boolean }> => {
  const hashedToken = hashData(token);

  // Find user by verification token using standard Prisma query
  const emailInfo = await prisma.emailInfo.findFirst({
    where: {
      verificationToken: hashedToken,
      verificationExpires: { gt: currentDate() },
    },
  });

  if (!emailInfo) {
    throwError("Invalid or expired email verification token", 403);
  }

  const userId = emailInfo.userId;
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

  // Update both tables atomically in a single transaction
  await prisma.$transaction([
    ...(pendingEmail
      ? [
          prisma.user.update({
            where: { id: userId },
            data: { email: pendingEmail },
          }),
        ]
      : []),
    prisma.emailInfo.update({
      where: { userId },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
        pendingEmail: null,
      },
    }),
  ]);

  // Extract the user from the last result (it's always the last operation)
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });

  logger.info("Email verified successfully", {
    userId,
    email: updatedUser!.email,
    isNewlyVerified,
    wasEmailChange: !!pendingEmail,
  });

  return {
    user: updatedUser as UserDetails,
    isNewlyVerified,
  };
};

// Authenticate a user with email and password
export const authenticateUser = async (
  email: string,
  password: string,
  service: string
): Promise<{ user: UserDetails | null; isValid: boolean }> => {
  const user = await prisma.user.findUnique({
    where: {
      email_service_id: {
        email: email.trim(),
        serviceId: service,
      },
    },
    include: userInclude,
  });

  // User not found
  if (!user) {
    return { user: null, isValid: false };
  }

  const userDetails = user as UserDetails;
  const emailInfo = userDetails.emailInfo;
  const passwordData = userDetails.passwordInfo;

  if (emailInfo?.provider && !passwordData?.hash) {
    throwError(
      `This account is linked to ${emailInfo.provider}. Please sign in using ${emailInfo.provider}, or set a password using 'Forgot Password' to enable password login.`,
      403
    );
  }

  // Email not verified
  if (!emailInfo?.isVerified) {
    throwError("Please verify your email before logging in", 403);
  }

  // Account is locked
  if (isAccountLocked(userDetails)) {
    throwError(
      "Account is temporarily locked due to multiple failed login attempts",
      423
    );
  }

  // Password does not match
  if (!(await comparePassword(passwordData?.hash ?? null, password))) {
    await incrementFailedLoginAttempts(userDetails);
    return { user: userDetails, isValid: false };
  }

  // Reset failed login attempts
  const lockout = userDetails.lockoutInfo;
  if (lockout && lockout.failedAttemptCount > 0) {
    await resetFailedLoginAttempts(userDetails.id);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: currentDate() },
  });

  return { user: userDetails, isValid: true };
};

// Increment the count of failed login attempts and lock account if needed
export const incrementFailedLoginAttempts = async (
  user: UserDetails
): Promise<void> => {
  const { maxLoginAttempts, loginLockTime } = config.security;

  const lockout = user.lockoutInfo;
  const newAttempts = (lockout?.failedAttemptCount ?? 0) + 1;
  const shouldLock = newAttempts >= maxLoginAttempts;

  await prisma.lockoutInfo.upsert({
    where: { userId: user.id },
    update: {
      failedAttemptCount: newAttempts,
      isLocked: shouldLock,
      ...(shouldLock && {
        lockedUntil: addMinutes(loginLockTime),
      }),
    },
    create: {
      userId: user.id,
      failedAttemptCount: newAttempts,
      isLocked: shouldLock,
      ...(shouldLock && {
        lockedUntil: addMinutes(loginLockTime),
      }),
    },
  });
};

// Reset failed login attempts and unlock the account
export const resetFailedLoginAttempts = async (
  userId: string
): Promise<void> => {
  await prisma.lockoutInfo.update({
    where: { userId: userId },
    data: {
      failedAttemptCount: 0,
      isLocked: false,
      lockedUntil: null,
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
    include: userInclude,
  });

  if (!user) return;

  const resetToken = generateRandomString(32);

  await prisma.passwordInfo.upsert({
    where: { userId: user.id },
    update: {
      resetToken: hashData(resetToken),
      resetExpires: addMinutes(30),
    },
    create: {
      userId: user.id,
      resetToken: hashData(resetToken),
      resetExpires: addMinutes(30),
    },
  });

  const emailTemplate = await generatePasswordResetTemplate(
    user.fullName,
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
      resetToken: hashedToken,
      resetExpires: { gt: currentDate() },
    },
    include: {
      user: {
        include: userInclude,
      },
    },
  });

  if (!passwordInfo) {
    throwError("Invalid or expired password reset token");
  }

  const userId = passwordInfo.userId;
  const hashedPassword = await hashPassword(newPassword);
  const user = passwordInfo.user as UserDetails;
  const lockoutInfo = user.lockoutInfo;
  const emailInfo = user.emailInfo;

  const isLocked = lockoutInfo?.isLocked ?? false;
  const isEmailUnverified = !emailInfo?.isVerified;
  // Update password info
  await prisma.passwordInfo.update({
    where: { userId: userId },
    data: {
      hash: hashedPassword,
      resetToken: null,
      resetExpires: null,
    },
  });

  // Unlock account if needed
  if (isLocked && lockoutInfo) {
    await prisma.lockoutInfo.update({
      where: { userId: userId },
      data: {
        isLocked: false,
        lockedUntil: null,
        failedAttemptCount: 0,
      },
    });
  }

  // Verify email if needed
  if (isEmailUnverified && emailInfo) {
    await prisma.emailInfo.update({
      where: { userId: userId },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });
  }

  // Revoke all user sessions
  await revokeAllUserSessions(userId);
};

// Update user profile
export const updateUserProfile = async (
  user: UserDetails,
  updates: UpdateUserProfile
): Promise<{ user: UserDetails; message: string }> => {
  const { fullName, phone, email, password, redirectUrl } = updates;

  const emailInfo = user.emailInfo;
  let message: string = "Profile updated successfully";
  let updatedUser = user;

  // Validate email/phone availability
  if (email) {
    const userExists = await checkUserExists(
      email,
      phone,
      user.serviceId,
      user.id
    );

    if (userExists.exists) {
      const existingUser = userExists.user;
      const existingEmailInfo = existingUser.emailInfo;
      if (existingEmailInfo?.isVerified) {
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
      // Update email info with pending email and verification token
      await prisma.emailInfo.update({
        where: { userId: user.id },
        data: {
          pendingEmail: email,
          verificationToken: hashed,
          verificationExpires: expires,
        },
      });

      // Send verification email to new email address
      await sendEmailVerification(
        email,
        user.fullName,
        token,
        redirectUrl!,
        true
      );

      message =
        "Profile updated. Verification email sent to your new email address. Please verify to complete the email change.";
    } catch (error) {
      // Rollback pending email on email send failure
      await prisma.emailInfo.update({
        where: { userId: user.id },
        data: {
          pendingEmail: null,
          verificationToken: emailInfo?.verificationToken ?? null,
          verificationExpires: emailInfo?.verificationExpires ?? null,
        },
      });

      throw error;
    }
  }

  // Prepare update data for other fields
  const updateData: {
    fullName?: string;
    phone?: string;
  } = {};

  // Update fullname
  if (fullName) {
    updateData.fullName = fullName;
  }

  // TODO: Update phone number with verification workflow
  if (phone && phone !== user.phone) {
    updateData.phone = phone;
  }

  // Update password
  if (password) {
    const hashedPassword = await hashPassword(password);

    await prisma.passwordInfo.upsert({
      where: { userId: user.id },
      update: {
        hash: hashedPassword,
      },
      create: {
        userId: user.id,
        hash: hashedPassword,
      },
    });

    message = "Password updated successfully";
  }

  // Apply all updates if any exist
  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  // Fetch updated user with relations
  updatedUser = (await prisma.user.findUnique({
    where: { id: user.id },
    include: userInclude,
  })) as UserDetails;

  return { user: updatedUser, message };
};
