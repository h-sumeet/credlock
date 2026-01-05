import jwt from "jsonwebtoken";
import type { IJWTPayload } from "../types/auth";
import { config } from "../config/app";
import { throwError } from "../utils/response";
import type { UserDetails } from "../types/user";

export const generateAccessToken = (user: UserDetails): string => {
  const payload: IJWTPayload = {
    userId: user.id,
    email: user.email,
    serviceId: user.serviceId,
    // fullname: user.fullName,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.app.name,
    audience: config.app.name,
    algorithm: "HS256",
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): IJWTPayload => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: config.app.name,
      audience: config.app.name,
      algorithms: ["HS256"],
    } as jwt.VerifyOptions) as IJWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throwError("Access token has expired", 401);
    } else if (error instanceof jwt.NotBeforeError) {
      throwError("Access token not yet valid", 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throwError("Invalid access token", 401);
    } else {
      throwError("Invalid or expired access token", 401);
    }
  }
};
