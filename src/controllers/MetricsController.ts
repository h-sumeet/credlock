import type { Request, Response, NextFunction } from "express";
import { getMetrics, getMetricsContentType } from "../services/PrometheusService";
import { logger } from "../helpers/logger";

/**
 * @desc Get Prometheus metrics
 * @route GET /metrics
 * @access Public
 */
export const getPrometheusMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const metrics = await getMetrics();

    res.setHeader("Content-Type", getMetricsContentType());
    res.send(metrics);
  } catch (error) {
    logger.error("Failed to retrieve metrics", { error });
    next(error);
  }
};