import {
  getRequiredEnvVar,
  getRequiredEnvNumber,
  getRequiredEnvBoolean,
  buildServiceConfig,
  getServiceConfig,
  getServiceEmailConfig,
  getServiceOAuthConfig,
} from "../../src/utils/env";

describe("Environment Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getRequiredEnvVar", () => {
    it("should return value when environment variable exists", () => {
      process.env.TEST_VAR = "test-value";

      const result = getRequiredEnvVar("TEST_VAR");

      expect(result).toBe("test-value");
    });

    it("should throw error when environment variable is not set", () => {
      delete process.env.MISSING_VAR;

      expect(() => getRequiredEnvVar("MISSING_VAR")).toThrow(
        "Required environment variable MISSING_VAR is not set"
      );
    });

    it("should throw error when environment variable is empty", () => {
      process.env.EMPTY_VAR = "";

      expect(() => getRequiredEnvVar("EMPTY_VAR")).toThrow(
        "Required environment variable EMPTY_VAR is not set"
      );
    });
  });

  describe("getRequiredEnvNumber", () => {
    it("should return number when valid", () => {
      process.env.NUM_VAR = "42";

      const result = getRequiredEnvNumber("NUM_VAR");

      expect(result).toBe(42);
    });

    it("should handle negative numbers", () => {
      process.env.NEG_VAR = "-10";

      const result = getRequiredEnvNumber("NEG_VAR");

      expect(result).toBe(-10);
    });

    it("should handle zero", () => {
      process.env.ZERO_VAR = "0";

      const result = getRequiredEnvNumber("ZERO_VAR");

      expect(result).toBe(0);
    });

    it("should throw error when not set", () => {
      delete process.env.MISSING_NUM;

      expect(() => getRequiredEnvNumber("MISSING_NUM")).toThrow(
        "Required environment variable MISSING_NUM is not set"
      );
    });

    it("should throw error for non-numeric value", () => {
      process.env.INVALID_NUM = "not-a-number";

      expect(() => getRequiredEnvNumber("INVALID_NUM")).toThrow(
        "Environment variable INVALID_NUM must be a valid number"
      );
    });

    it("should throw error for decimal value", () => {
      process.env.DECIMAL_VAR = "3.14";

      expect(() => getRequiredEnvNumber("DECIMAL_VAR")).toThrow(
        "Environment variable DECIMAL_VAR must be a valid number"
      );
    });

    it("should throw error for scientific notation", () => {
      process.env.SCIENTIFIC_VAR = "1e5";

      expect(() => getRequiredEnvNumber("SCIENTIFIC_VAR")).toThrow(
        "Environment variable SCIENTIFIC_VAR must be a valid number"
      );
    });

    it("should trim whitespace before parsing", () => {
      process.env.WHITESPACE_VAR = "  100  ";

      const result = getRequiredEnvNumber("WHITESPACE_VAR");

      expect(result).toBe(100);
    });
  });

  describe("getRequiredEnvBoolean", () => {
    it("should return true for 'true' value", () => {
      process.env.BOOL_TRUE = "true";

      const result = getRequiredEnvBoolean("BOOL_TRUE");

      expect(result).toBe(true);
    });

    it("should return false for 'false' value", () => {
      process.env.BOOL_FALSE = "false";

      const result = getRequiredEnvBoolean("BOOL_FALSE");

      expect(result).toBe(false);
    });

    it("should be case insensitive", () => {
      process.env.BOOL_UPPER = "TRUE";
      process.env.BOOL_MIXED = "FaLsE";

      expect(getRequiredEnvBoolean("BOOL_UPPER")).toBe(true);
      expect(getRequiredEnvBoolean("BOOL_MIXED")).toBe(false);
    });

    it("should trim whitespace", () => {
      process.env.BOOL_WHITESPACE = "  true  ";

      const result = getRequiredEnvBoolean("BOOL_WHITESPACE");

      expect(result).toBe(true);
    });

    it("should throw error when not set", () => {
      delete process.env.MISSING_BOOL;

      expect(() => getRequiredEnvBoolean("MISSING_BOOL")).toThrow(
        "Required environment variable MISSING_BOOL is not set"
      );
    });

    it("should throw error for invalid boolean value", () => {
      process.env.INVALID_BOOL = "yes";

      expect(() => getRequiredEnvBoolean("INVALID_BOOL")).toThrow(
        "Environment variable INVALID_BOOL must be 'true' or 'false'"
      );
    });
  });

  describe("buildServiceConfig", () => {
    beforeEach(() => {
      // Set up all required environment variables with prefix
      process.env.TEST_EMAIL_HOST = "smtp.example.com";
      process.env.TEST_EMAIL_PORT = "587";
      process.env.TEST_EMAIL_SECURE = "true";
      process.env.TEST_EMAIL_USER = "user@example.com";
      process.env.TEST_EMAIL_PASSWORD = "password123";
      process.env.TEST_EMAIL_FROM = "noreply@example.com";
      process.env.TEST_GOOGLE_CLIENT_ID = "google-client-id";
      process.env.TEST_GOOGLE_CLIENT_SECRET = "google-client-secret";
      process.env.TEST_GOOGLE_CALLBACK_URL = "http://localhost/callback/google";
      process.env.TEST_GITHUB_CLIENT_ID = "github-client-id";
      process.env.TEST_GITHUB_CLIENT_SECRET = "github-client-secret";
      process.env.TEST_GITHUB_CALLBACK_URL = "http://localhost/callback/github";
    });

    it("should build service config with prefix", () => {
      const result = buildServiceConfig("TEST");

      expect(result).toEqual({
        email: {
          host: "smtp.example.com",
          port: 587,
          secure: true,
          user: "user@example.com",
          password: "password123",
          from: "noreply@example.com",
        },
        oauth: {
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            callbackUrl: "http://localhost/callback/google",
          },
          github: {
            clientId: "github-client-id",
            clientSecret: "github-client-secret",
            callbackUrl: "http://localhost/callback/github",
          },
        },
      });
    });

    it("should throw error when required email config is missing", () => {
      delete process.env.TEST_EMAIL_HOST;

      expect(() => buildServiceConfig("TEST")).toThrow(
        "Required environment variable TEST_EMAIL_HOST is not set"
      );
    });

    it("should throw error when required OAuth config is missing", () => {
      delete process.env.TEST_GOOGLE_CLIENT_ID;

      expect(() => buildServiceConfig("TEST")).toThrow(
        "Required environment variable TEST_GOOGLE_CLIENT_ID is not set"
      );
    });
  });

  describe("getServiceConfig", () => {
    it("should return service config for valid service", () => {
      const result = getServiceConfig("examaxis");

      // Just verify the function returns a valid config object structure
      expect(result).toBeDefined();
      expect(result.email).toBeDefined();
      expect(result.oauth).toBeDefined();
      expect(result.oauth.google).toBeDefined();
      expect(result.oauth.github).toBeDefined();
    });

    it("should throw error for invalid service", () => {
      expect(() => getServiceConfig("invalid-service" as any)).toThrow(
        "Service configuration not found for: invalid-service"
      );
    });
  });

  describe("getServiceEmailConfig", () => {
    it("should return email config for valid service", () => {
      const result = getServiceEmailConfig("examaxis");

      // Verify it returns a valid email config structure
      expect(result).toBeDefined();
      expect(result.host).toBeDefined();
      expect(result.port).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.from).toBeDefined();
    });
  });

  describe("getServiceOAuthConfig", () => {
    it("should return OAuth config for valid service", () => {
      const result = getServiceOAuthConfig("examaxis");

      // Verify it returns a valid OAuth config structure
      expect(result).toBeDefined();
      expect(result.google).toBeDefined();
      expect(result.github).toBeDefined();
      expect(result.google.clientId).toBeDefined();
      expect(result.github.clientId).toBeDefined();
    });
  });
});
