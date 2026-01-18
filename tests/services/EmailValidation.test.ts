import axios, { AxiosError } from "axios";
import { isDisposableEmail } from "../../src/services/EmailValidation";
import { DISPOSABLE_EMAIL_API } from "../../src/constants/common";

// Mock dependencies
jest.mock("axios");
jest.mock("../../src/helpers/logger");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("EmailValidation Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isDisposableEmail", () => {
    it("should return true for disposable email", async () => {
      mockedAxios.get.mockResolvedValue({
        data: { disposable: "true" },
        status: 200,
      });

      const result = await isDisposableEmail("test@tempmail.com");

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(DISPOSABLE_EMAIL_API, {
        params: { email: "test@tempmail.com" },
        timeout: 5000,
        headers: { Accept: "application/json" },
        validateStatus: expect.any(Function),
      });
    });

    it("should return false for non-disposable email", async () => {
      mockedAxios.get.mockResolvedValue({
        data: { disposable: "false" },
        status: 200,
      });

      const result = await isDisposableEmail("test@gmail.com");

      expect(result).toBe(false);
    });

    it("should trim email before checking", async () => {
      mockedAxios.get.mockResolvedValue({
        data: { disposable: "false" },
        status: 200,
      });

      await isDisposableEmail("  test@gmail.com  ");

      expect(mockedAxios.get).toHaveBeenCalledWith(
        DISPOSABLE_EMAIL_API,
        expect.objectContaining({
          params: { email: "test@gmail.com" },
        })
      );
    });

    it("should return false on API timeout", async () => {
      const timeoutError = new Error("ETIMEDOUT") as AxiosError;
      timeoutError.code = "ECONNABORTED";
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      const networkError = new Error("Network Error") as AxiosError;
      networkError.code = "ERR_NETWORK";
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(networkError);

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });

    it("should return false on unexpected response format", async () => {
      mockedAxios.get.mockResolvedValue({
        data: { unexpected: "format" },
        status: 200,
      });

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });

    it("should return false on empty response", async () => {
      mockedAxios.get.mockResolvedValue({
        data: null,
        status: 200,
      });

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });

    it("should return false when disposable field is not a string", async () => {
      mockedAxios.get.mockResolvedValue({
        data: { disposable: true }, // boolean instead of string
        status: 200,
      });

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });

    it("should handle non-axios errors gracefully", async () => {
      mockedAxios.isAxiosError.mockReturnValue(false);
      mockedAxios.get.mockRejectedValue(new Error("Unknown error"));

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });

    it("should handle API response status errors", async () => {
      const statusError = new Error("Request failed") as AxiosError;
      statusError.response = { status: 500 } as any;
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(statusError);

      const result = await isDisposableEmail("test@example.com");

      expect(result).toBe(false);
    });
  });
});
