export const ENV: Record<string, string> = {
  dev: "development",
  prod: "production",
} as const;

export const GITHUB_EMAIL_API = "https://api.github.com/user/emails" as const;
export const DISPOSABLE_EMAIL_API = "https://disposable.debounce.io" as const;

export const AUTH_PROVIDERS = {
  GITHUB: "github",
  GOOGLE: "google",
} as const;

export const SERVICES = {
  EXAMAXIS: "examaxis",
} as const;

export type ServiceId = typeof SERVICES[keyof typeof SERVICES];

export const HTTP_HEADERS = {
  AUTHORIZATION: "authorization",
  REFRESH_TOKEN: "x-refresh-token",
  SERVICE_ID: "x-service-id",
  DEVICE_ID: "x-device-id",
} as const;

export const LOGIN_CODE_EXPIRY_MINUTES = 5 as const;
export const EMAIL_TOKEN_EXPIRY_IN_MINUTES = 1440 as const; // 1 day
export const PASSWORD_TOKEN_EXPIRY_IN_MINUTES = 30 as const; // 30 minutes