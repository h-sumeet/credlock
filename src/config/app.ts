import dotenvx from "@dotenvx/dotenvx";
dotenvx.config({ ignore: ["MISSING_ENV_FILE"] });

import type { IConfig } from "../types/config";
import { getRequiredEnvNumber, getRequiredEnvVar } from "../utils/env";
import { convertToMilliseconds } from "../utils/dayjs";

export const config: IConfig = {
  port: getRequiredEnvNumber("PORT"),
  nodeEnv: getRequiredEnvVar("NODE_ENV"),
  logLevel: getRequiredEnvVar("LOG_LEVEL"),
  version: getRequiredEnvVar("APP_VERSION"),

  app: {
    name: getRequiredEnvVar("APP_NAME"),
    url: `${getRequiredEnvVar("BASE_URL")}:${getRequiredEnvNumber("PORT")}`,
  },

  cors: getRequiredEnvVar("CORS_ORIGINS")
    .split(",")
    .map((origin) => origin.trim()),

  jwt: {
    secret: getRequiredEnvVar("JWT_SECRET"),
    refreshSecret: getRequiredEnvVar("JWT_REFRESH_SECRET"),
    expiresIn: getRequiredEnvVar("JWT_EXPIRES_IN"),
    refreshExpiresIn: getRequiredEnvVar("JWT_REFRESH_EXPIRES_IN"),
  },

  email: {
    host: getRequiredEnvVar("EMAIL_HOST"),
    port: getRequiredEnvNumber("EMAIL_PORT"),
    secure: getRequiredEnvVar("EMAIL_SECURE") === "true",
    user: getRequiredEnvVar("EMAIL_USER"),
    password: getRequiredEnvVar("EMAIL_PASSWORD"),
    from: getRequiredEnvVar("EMAIL_FROM"),
  },

  security: {
    bcryptRounds: getRequiredEnvNumber("BCRYPT_ROUNDS"),
    maxLoginAttempts: getRequiredEnvNumber("MAX_LOGIN_ATTEMPTS"),
    loginLockTime: getRequiredEnvNumber("LOCK_TIME"),
    maxRegistrationAttempts: getRequiredEnvNumber("MAX_REGISTRATION_ATTEMPTS"),
    registrationLockTime: getRequiredEnvNumber("REGISTRATION_LOCK_TIME"),
  },

  rateLimit: {
    windowMs: convertToMilliseconds(getRequiredEnvNumber("RATE_LIMIT_WINDOW")),
    maxRequests: getRequiredEnvNumber("RATE_LIMIT_MAX_REQUESTS"),
  },

  discordAlert: getRequiredEnvVar("DISCORD_WEBHOOK_URL"),
  postgresqlUrl: getRequiredEnvVar("POSTGRESQL_URL"),

  oauth: {
    google: {
      clientId: getRequiredEnvVar("GOOGLE_CLIENT_ID"),
      clientSecret: getRequiredEnvVar("GOOGLE_CLIENT_SECRET"),
      callbackUrl: getRequiredEnvVar("GOOGLE_CALLBACK_URL"),
    },
    github: {
      clientId: getRequiredEnvVar("GITHUB_CLIENT_ID"),
      clientSecret: getRequiredEnvVar("GITHUB_CLIENT_SECRET"),
      callbackUrl: getRequiredEnvVar("GITHUB_CALLBACK_URL"),
    },
  },
};
