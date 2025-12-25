import type { Request, Response, NextFunction } from "express";
import { SERVICES, SERVICE_HEADER } from "../constants/common";
import { throwError } from "../utils/response";

/**
 * Middleware to extract and validate service header
 */
export const extractService = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const service = req.headers[SERVICE_HEADER] as string;

    if (!service) {
      throwError("Service header is required", 400);
    }

    const validServices = Object.values(SERVICES) as string[];
    if (!validServices.includes(service)) {
      throwError("Invalid service.", 400);
    }

    req.service = service;
    next();
  } catch (error) {
    next(error);
  }
};
