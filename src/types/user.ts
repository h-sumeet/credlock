import { AUTH_PROVIDERS } from "../constants/common";
import type { TokenPair } from "./auth";
import type { User } from "@prisma/client";

export interface IOAuthUser {
  email: string;
  isVerified: boolean;
  provider: typeof AUTH_PROVIDERS.GOOGLE | typeof AUTH_PROVIDERS.GITHUB;
  displayName: string;
  avatarUrl?: string;
}

export interface LoginStoreRecord {
  user: User;
  tokens: TokenPair;
  expiresAt: number;
}

export interface UpdateUserProfile {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  redirectUrl?: string;
}

export type UserExistsResult = { exists: false } | { exists: true; user: User };
