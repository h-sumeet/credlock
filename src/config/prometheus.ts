import promClient from "prom-client";
import { logger } from "../helpers/logger";
import { config } from "../config/app";

/**
 * Prometheus Client Configuration
 * Centralizes Prometheus registry and default metrics collection
 */

// Create a Registry to register all metrics
export const prometheusRegister = new promClient.Registry();

// Set default labels for all metrics
prometheusRegister.setDefaultLabels({
  app: "examaxis-api",
  environment: config.nodeEnv,
});

// Collect default metrics (CPU, memory, event loop, GC, etc.)
promClient.collectDefaultMetrics({
  register: prometheusRegister,
  prefix: "examaxis_",
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // GC duration buckets in seconds
  eventLoopMonitoringPrecision: 10, // Sample rate for event loop monitoring
});

logger.info("Prometheus client initialized with default metrics");

export { promClient };