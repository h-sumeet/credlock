import { AUTH_PROVIDERS } from "../constants/common";
import type { TokenPair } from "./auth";
import type {
  User,
  EmailInfo,
  PhoneInfo,
  PasswordInfo,
  LockoutInfo,
} from "@prisma/client";

export interface IOAuthUser {
  email: string;
  serviceId: string;
  isVerified: boolean;
  provider: typeof AUTH_PROVIDERS.GOOGLE | typeof AUTH_PROVIDERS.GITHUB;
  displayName: string;
  avatarUrl?: string;
}

export interface LoginStoreRecord {
  user: UserDetails;
  tokens: TokenPair;
  expiresAt: number;
}

export interface UpdateUserProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  redirectUrl?: string;
}

export type UserExistsResult =
  | { exists: false }
  | { exists: true; user: UserDetails; field: "email" | "phone" };

// User with all relations loaded
export type UserDetails = User & {
  emailInfo: EmailInfo;
  phoneInfo: PhoneInfo;
  passwordInfo: PasswordInfo;
  lockoutInfo: LockoutInfo;
};

// Re-export Prisma types for convenience
export type { User, EmailInfo, PhoneInfo, PasswordInfo, LockoutInfo };
