import { sendDiscordAlert } from "../../src/helpers/discord";
import { config } from "../../src/config/app";
import { logger } from "../../src/helpers/logger";

// Mock dependencies
jest.mock("../../src/config/app");
jest.mock("../../src/helpers/logger");

const mockedConfig = config as jest.Mocked<typeof config>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Discord Helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("sendDiscordAlert", () => {
    it("should send alert in production environment with valid webhook", async () => {
      mockedConfig.nodeEnv = "production";
      mockedConfig.discordAlert = "https://discord.com/api/webhooks/test";
      mockedConfig.app = { name: "TestApp", url: "http://localhost" };

      mockFetch.mockResolvedValue({
        ok: true,
        statusText: "OK",
      });

      await sendDiscordAlert("Test error message");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "**Error in production: TestApp**\n\nTest error message",
          }),
        }
      );
    });

    it("should not send alert in non-production environment", async () => {
      mockedConfig.nodeEnv = "development";
      mockedConfig.discordAlert = "https://discord.com/api/webhooks/test";

      await sendDiscordAlert("Test error message");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not send alert when webhook URL is not configured", async () => {
      mockedConfig.nodeEnv = "production";
      mockedConfig.discordAlert = "";

      await sendDiscordAlert("Test error message");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not send alert when webhook URL is undefined", async () => {
      mockedConfig.nodeEnv = "production";
      (mockedConfig as any).discordAlert = undefined;

      await sendDiscordAlert("Test error message");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should log error when fetch response is not ok", async () => {
      mockedConfig.nodeEnv = "production";
      mockedConfig.discordAlert = "https://discord.com/api/webhooks/test";
      mockedConfig.app = { name: "TestApp", url: "http://localhost" };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
      });

      await sendDiscordAlert("Test error message");

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to send Discord alert:",
        "Bad Request"
      );
    });

    it("should log error when fetch throws exception", async () => {
      mockedConfig.nodeEnv = "production";
      mockedConfig.discordAlert = "https://discord.com/api/webhooks/test";
      mockedConfig.app = { name: "TestApp", url: "http://localhost" };

      const networkError = new Error("Network error");
      mockFetch.mockRejectedValue(networkError);

      await sendDiscordAlert("Test error message");

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to send Discord alert:",
        networkError
      );
    });

    it("should include app name in alert message", async () => {
      mockedConfig.nodeEnv = "production";
      mockedConfig.discordAlert = "https://discord.com/api/webhooks/test";
      mockedConfig.app = { name: "CredLock", url: "http://localhost" };

      mockFetch.mockResolvedValue({
        ok: true,
        statusText: "OK",
      });

      await sendDiscordAlert("Database connection failed");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            content:
              "**Error in production: CredLock**\n\nDatabase connection failed",
          }),
        })
      );
    });
  });
});
