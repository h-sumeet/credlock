import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { config } from "../config/app";
import { generateRandomString, hashData } from "../utils/crypto";
import { addMinutes, currentDate } from "../utils/dayjs";
import type { User } from "@prisma/client";

/**
 * Serialize a Prisma User object to a clean API response format
 * Removes sensitive fields like password hash and internal tokens
 */
export const serializeUser = (user: User) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.phone && { phone: user.phone }),
    ...(user.avatar && { avatar: user.avatar }),
    ...(user.provider && { provider: user.provider }),
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
// Use duration in minutes for short-lived tokens
export const generateVerificationToken = (
  duration: number
): {
  token: string;
  hashed: string;
  expires: Date;
} => {
  const token = generateRandomString(32);
  const hashed = hashData(token);
  const expires = addMinutes(duration);
  return { token, hashed, expires };
};

// Check if the user's account is currently locked
export const isAccountLocked = (lockedUntil: Date | null): boolean => {
  return !!(
    lockedUntil &&
    dayjs(lockedUntil).isAfter(currentDate())
  );
};
