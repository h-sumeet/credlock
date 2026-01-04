import { promClient, prometheusRegister } from "../config/prometheus";
import { logger } from "../helpers/logger";

/**
 * Prometheus Metrics Service
 * Simple metrics for testing and basic monitoring
 */

/**
 * HTTP Request Counter (Simple test metric)
 * Counts total number of HTTP requests
 */
export const httpRequestCounter = new promClient.Counter({
  name: "examaxis_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"], // Added 'route' label
  registers: [prometheusRegister],
});

/**
 * Active Requests Gauge (Simple test metric)
 * Tracks current number of active requests
 */
export const activeRequestsGauge = new promClient.Gauge({
  name: "examaxis_active_requests",
  help: "Number of active HTTP requests",
  registers: [prometheusRegister],
});

/**
 * Get all metrics in Prometheus format
 */
export const getMetrics = async (): Promise<string> => {
  try {
    return await prometheusRegister.metrics();
  } catch (error) {
    logger.error("Failed to retrieve Prometheus metrics", { error });
    throw error;
  }
};

/**
 * Get metrics content type for HTTP response
 */
export const getMetricsContentType = (): string => {
  return prometheusRegister.contentType;
};

logger.info("Prometheus service initialized");
