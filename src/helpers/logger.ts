import winston from "winston";
import { sendDiscordAlert } from "./discord";
import { formatTimestamp } from "../utils/dayjs";
import { config } from "../config/app";

// Define error type with isOperational property
interface OperationalError extends Error {
  isOperational?: boolean;
}

// Custom format for better error serialization and Discord alerts
const errorFormat = winston.format((info) => {
  if (info["error"] instanceof Error) {
    const error = info["error"] as OperationalError;
    info["error"] = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      isOperational: error.isOperational,
    };
  }

  if (info.level === "error") {
    const lines = [];

    lines.push(`Time: ${formatTimestamp()}`);
    lines.push(`Error: ${info.message}`);

    // Add cause from error message
    if (
      info["error"] &&
      typeof info["error"] === "object" &&
      "message" in info["error"]
    ) {
      lines.push(`cause: ${info["error"].message}`);
    }

    // Include all meta except reserved keys
    const metaKeys = Object.keys(info).filter(
      (key) => !["level", "message", "error", "service"].includes(key)
    );

    for (const key of metaKeys) {
      let value = info[key];
      if (typeof value === "object") {
        try {
          value = JSON.stringify(value, null, 2);
        } catch {
          value = String(value);
        }
      }
      lines.push(`${key}: ${value}`);
    }

    // Check if error is operational
    const isOperational =
      info["error"] &&
      typeof info["error"] === "object" &&
      "isOperational" in info["error"] &&
      info["error"].isOperational === true;

    // Only show stack for non-operational errors
    if (
      !isOperational &&
      info["error"] &&
      typeof info["error"] === "object" &&
      "stack" in info["error"] &&
      typeof info["error"].stack === "string"
    ) {
      const stackLines = info["error"].stack.split("\n");
      stackLines.shift(); // Remove the first line (error message)

      lines.push(`Stack: Detailed error stack\n${stackLines.join("\n")}`);
    }

    const alertMessage = lines.join("\n");
    sendDiscordAlert(alertMessage);
  }

  return info;
});

// Human-readable console format
const consoleFormat = winston.format.printf(({ level, message, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
  return `${level} [${formatTimestamp()}] ${message} ${metaString}`;
});

// Setup transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), consoleFormat),
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    errorFormat(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: config.app.name },
  transports,
});

export { logger };
