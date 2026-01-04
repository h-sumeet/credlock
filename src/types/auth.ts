import type { User } from "@prisma/client";

export interface IJWTPayload {
  userId: string;
  email: string;
  service: string;
  fullname?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Express Request interface extension
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    jwt?: IJWTPayload;
    service?: string;
  }
}
