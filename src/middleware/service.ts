import type { Request, Response, NextFunction } from "express";
import { HTTP_HEADERS, SERVICES } from "../constants/common";
import { throwError } from "../utils/response";

/**
 * Middleware to extract and validate service header
 */
export const validateServiceHeader = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const serviceId = req.headers[HTTP_HEADERS.SERVICE_ID] as string;

    if (!serviceId) {
      throwError("Service header is required", 400);
    }

    const validServices = Object.values(SERVICES) as string[];
    if (!validServices.includes(serviceId)) {
      throwError("Invalid service.", 400);
    }

    req.serviceId = serviceId;
    next();
  } catch (error) {
    next(error);
  }
};
