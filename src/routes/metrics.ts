import { Router } from "express";
import { getPrometheusMetrics } from "../controllers/MetricsController";

const router = Router();

/**
 * @route GET /metrics
 * @desc Get all Prometheus metrics
 * @access Public
 */
router.get("/", getPrometheusMetrics);

export default router;