import type { UserDetails } from "./user";

export interface IJWTPayload {
  userId: string;
  email: string;
  serviceId: string;
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
    user?: UserDetails;
    jwt?: IJWTPayload;
    serviceId?: string;
  }
}
