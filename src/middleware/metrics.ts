import type { Request, Response, NextFunction } from "express";
import {
  httpRequestCounter,
  activeRequestsGauge,
} from "../services/PrometheusService";

/**
 * Metrics middleware for tracking HTTP requests
 * Tracks method, status, and route pattern
 */
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip metrics endpoint itself
  if (req.path === "/metrics") {
    return next();
  }

  // Increment active requests
  activeRequestsGauge.inc();

  // Track when response finishes
  res.on("finish", () => {
    // Decrement active requests
    activeRequestsGauge.dec();

    // Get route pattern (e.g., /api/users/:id instead of /api/users/123)
    const route = req.route?.path
      ? `${req.baseUrl || ""}${req.route.path}`
      : req.path;

    // Count completed request with route information
    httpRequestCounter.inc({
      method: req.method,
      route: route,
      status: res.statusCode.toString(),
    });
  });

  next();
};
