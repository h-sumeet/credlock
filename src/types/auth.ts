export interface IJWTPayload {
  userId: string;
  name?: string;
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
    userId: string;
    deviceId?: string;
    jwt?: IJWTPayload;
  }
}
