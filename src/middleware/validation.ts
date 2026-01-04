import Joi from "joi";
import type { Request, Response, NextFunction } from "express";
import { throwError } from "../utils/response";
import { logger } from "../helpers/logger";

// Full name validation schema
const fullnameSchema = Joi.string()
  .min(2)
  .max(100)
  .trim()
  .pattern(/^[a-zA-Z\s\-'.]+$/)
  .messages({
    "string.min": "Full name must be at least 2 characters",
    "string.max": "Full name cannot exceed 100 characters",
    "string.pattern.base":
      "Full name can only contain letters, spaces, hyphens, apostrophes, and periods",
    "string.empty": "Full name is required",
    "any.required": "Full name is required",
  });

// Email validation schema
const emailSchema = Joi.string()
  .email({ minDomainSegments: 2, tlds: { allow: false } })
  .trim()
  .lowercase()
  .max(255)
  .messages({
    "string.email": "Please provide a valid email address",
    "string.max": "Email cannot exceed 255 characters",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  });

// Phone validation schema
const phoneSchema = Joi.string()
  .trim()
  .pattern(/^[+][1-9][\d]{6,15}$/)
  .messages({
    "string.pattern.base":
      "Please provide a valid phone number with country code (e.g., +1234567890)",
  });

// Password validation schema
const passwordSchema = Joi.string()
  .min(6)
  .max(128)
  .pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/
  )
  .messages({
    "string.min": "Password must be at least 6 characters long",
    "string.max": "Password cannot exceed 128 characters",
    "string.pattern.base":
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&#)",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  });

// Redirect URL validation schema
const redirectUrlSchema = Joi.string()
  .uri({ scheme: ["http", "https"] })
  .trim()
  .required()
  .messages({
    "string.uri": "Redirect URL must be a valid URL",
    "string.uriCustomScheme": "Redirect URL must be HTTP or HTTPS",
    "string.empty": "Redirect URL is required",
    "any.required": "Redirect URL is required",
  });

// User registration validation schema
export const registerSchema = Joi.object({
  fullname: fullnameSchema.required(),
  email: emailSchema.required(),
  phone: phoneSchema.optional(),
  password: passwordSchema.required(),
  redirectUrl: redirectUrlSchema.required(),
});

// User login validation schema
export const loginSchema = Joi.object({
  email: emailSchema.required(),
  password: passwordSchema.required(),
});

// Profile update validation schema
export const updateProfileSchema = Joi.object({
  fullname: fullnameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema.optional(),
  redirectUrl: redirectUrlSchema.optional(),
})
  .custom((value, helpers) => {
    // If email is provided, redirectUrl must be provided
    if (value.email && !value.redirectUrl) {
      return helpers.error("any.custom", {
        message: "redirectUrl is required when changing email",
      });
    }
    return value;
  })
  .messages({ "any.custom": "{{#message}}" });

// Email verification validation schema
export const verifyEmailSchema = Joi.object({
  token: Joi.string().required().messages({
    "string.empty": "Verification token is required",
    "any.required": "Verification token is required",
  }),
});

// Password reset request validation schema
export const forgotPasswordSchema = Joi.object({
  email: emailSchema.required(),
  redirectUrl: redirectUrlSchema.required(),
});

// Password reset validation schema
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "string.empty": "Reset token is required",
    "any.required": "Reset token is required",
  }),
  password: passwordSchema.required(),
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
  "x-refresh-token": Joi.string().min(40).max(200).required().messages({
    "string.empty": "Refresh token is required",
    "any.required": "Refresh token is required",
    "string.min": "Invalid refresh token length",
    "string.max": "Invalid refresh token length",
  }),
}).unknown(true);

// OAuth parameters validation schema
export const oauthParamsSchema = Joi.object({
  redirectUrl: redirectUrlSchema,
  nextUrl: redirectUrlSchema.optional(),
});

// Token header validation schema
export const tokenHeaderSchema = Joi.object({
  authorization: Joi.string()
    .pattern(/^Bearer\s[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/)
    .required()
    .messages({
      "string.pattern.base": "Access token must be a valid JWT",
      "string.empty": "Authorization token is required",
      "any.required": "Authorization header is required",
    }),
  "x-refresh-token": refreshTokenSchema.extract("x-refresh-token"),
}).unknown(true);

// Validation middleware function
export const validate = (
  schema: Joi.ObjectSchema,
  source: "body" | "headers" | "params" | "query" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract data from the request (body, headers, or params)
      const data = req[source];

      // Validate data against schema
      const { error, value } = schema.validate(data, {
        abortEarly: true, // stop validation on the first error
        stripUnknown: true, // remove fields not defined in the schema
      });

      // If validation failed, custom error handler will catch it
      if (error) throwError(error.details[0]!.message, 400);
      
      // Replace original request data with the validated value
      if(source !== "query") req[source] = value;
      next();
    } catch (err) {
      logger.error(`Validation error for ${source}:`, err);
      next(err);
    }
  };
};
