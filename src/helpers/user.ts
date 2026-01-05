import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { config } from "../config/app";
import { generateRandomString, hashData } from "../utils/crypto";
import { addDays, addMinutes, currentDate } from "../utils/dayjs";
import type { UserDetails } from "../types/user";

/**
 * Serialize a Prisma User object to a clean API response format
 * Removes sensitive fields like password hash and internal tokens
 */
export const serializeUser = (user: UserDetails) => {
  return {
    id: user.id,
    fullName: user.fullName,
    ...(user.profileImage && {
      profileImage: user.profileImage,
    }),
    email: user.email,
    emailVerified: user.emailInfo.isVerified,
    ...(user.emailInfo.provider && {
      emailProvider: user.emailInfo.provider,
    }),
    ...(user.phone && {
      phone: user.phone,
      phoneVerified: user.phoneInfo?.isVerified ?? false,
    }),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// Hash a plain-text password using bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(config.security.bcryptRounds);
  return bcrypt.hash(password, salt);
};

// Compare an input password with the stored hashed password
export const comparePassword = async (
  hash: string | null,
  input: string
): Promise<boolean> => {
  if (!hash) return false;
  return bcrypt.compare(input, hash);
};

// Generate a hashed verification token with configurable expiry
// Use duration in minutes for short-lived tokens (e.g., 10 for phone)
// Use duration in days for long-lived tokens (e.g., 1 for email)
export const generateVerificationToken = (
  duration: number,
  unit: "minutes" | "days" = "minutes"
): {
  token: string;
  hashed: string;
  expires: Date;
} => {
  const token = generateRandomString(32);
  const hashed = hashData(token);
  const expires = unit === "days" ? addDays(duration) : addMinutes(duration);
  return { token, hashed, expires };
};

// Check if the user's account is currently locked
export const isAccountLocked = (user: UserDetails): boolean => {
  return !!(
    user.lockoutInfo.isLocked &&
    user.lockoutInfo.lockedUntil &&
    dayjs(user.lockoutInfo.lockedUntil).isAfter(currentDate())
  );
};
