import axios, { AxiosError } from "axios";
import { logger } from "../helpers/logger";
import { DISPOSABLE_EMAIL_API } from "../constants/common";

interface DisposableEmailResponse {
  disposable?: string;
}

/**
 * Check if email is disposable using external API
 * Implements fail-open approach: if API fails, allow registration
 */
export const isDisposableEmail = async (email: string): Promise<boolean> => {
  try {
    const trimmedEmail = email.trim();

    const response = await axios.get<DisposableEmailResponse>(
      DISPOSABLE_EMAIL_API,
      {
        params: { email: trimmedEmail },
        timeout: 5000, // 5 second timeout
        headers: {
          Accept: "application/json",
        },
        validateStatus: (status) => status === 200, // Only accept 200 as valid
      }
    );

    // API returns {"disposable":"true"} or {"disposable":"false"}
    if (response.data && typeof response.data.disposable === "string") {
      const isDisposable = response.data.disposable === "true";

      if (isDisposable) {
        logger.info("Disposable email detected", { email: trimmedEmail });
      }

      return isDisposable;
    }

    // Unexpected data format
    logger.warn("Disposable email API returned unexpected data format", {
      status: response.status,
      data: response.data,
      email: trimmedEmail,
    });
    return false;
  } catch (error) {
    // Handle different types of errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.warn("Error calling disposable email API", {
        message: axiosError.message,
        code: axiosError.code,
        responseStatus: axiosError.response?.status,
        email: email.trim(),
      });
    } else {
      logger.warn("Unexpected error during disposable email check", {
        error: error instanceof Error ? error.message : String(error),
        email: email.trim(),
      });
    }
    return false;
  }
};
