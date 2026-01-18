import type { Request, Response, NextFunction } from "express";
import Passport from "passport";
import { throwError } from "../utils/response";
import { getStrategyName } from "../config/passport";
import type { ServiceId } from "../constants/common";

/**
 * Dynamic passport authenticate middleware based on serviceId in state
 */
export const authenticateWithService = (provider: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = req.query["state"] as string;
      if (!state) {
        throwError("Missing state parameter", 400);
      }

      const { serviceId } = JSON.parse(state);
      if (!serviceId) {
        throwError("Missing serviceId in state", 400);
      }

      const strategyName = getStrategyName(provider, serviceId as ServiceId);
      Passport.authenticate(strategyName, { session: false })(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};