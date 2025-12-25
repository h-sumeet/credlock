import { logger } from "../helpers/logger";
import { DISPOSABLE_EMAIL_API } from "../constants/common";

/**
 * Check if email is disposable
 */
export const isDisposableEmail = async (email: string): Promise<boolean> => {
  try {
    const trimmedEmail = email.trim();
    const url = `${DISPOSABLE_EMAIL_API}?email=${encodeURIComponent(
      trimmedEmail
    )}`;

    // Use AbortController for timeout (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (response.status === 200) {
      const data = (await response.json()) as { disposable?: string };

      // API returns {"disposable":"true"} or {"disposable":"false"}
      if (data && typeof data.disposable === "string") {
        return data.disposable === "true";
      }
    }

    // If response is not 200 or data format is unexpected, don't block
    logger.warn("Disposable email API returned unexpected response", {
      status: response.status,
      email: trimmedEmail,
    });
    return false;
  } catch (error) {
    // If API fails, don't block users (fail-open approach)
    logger.warn("Disposable email API check failed, allowing registration", {
      error: error instanceof Error ? error.message : String(error),
      email: email.trim(),
    });
    return false;
  }
};
