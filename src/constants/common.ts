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

export const LOGIN_CODE_EXPIRY_MINUTES = 5 as const;

export const SERVICES = {
  EXAMAXIS: "examaxis",
} as const;

export const CUSTOM_HEADERS = {
  REFRESH_TOKEN: "x-refresh-token",
  SERVICE_HEADER: "x-service",
};
