import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  tokenHeaderSchema,
  updateProfileSchema,
  validate,
  verifyEmailSchema,
} from "../middleware/validation";
import {
  forgotPassword,
  getProfile,
  login,
  logout,
  logoutAll,
  refreshToken,
  register,
  resetPassword,
  updateProfile,
  verifyEmail,
} from "../controllers/UserController";

const router = Router();

// Public routes
router.post("/signup", validate(registerSchema), register);
router.post("/signin", validate(loginSchema), login);
router.post("/refresh-token", validate(refreshTokenSchema, "headers"), refreshToken);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// Protected routes require authentication
router.use(validate(tokenHeaderSchema, "headers"), authenticate);

router.get("/profile", getProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);
router.post("/logout", logout);
router.post("/logout-all", logoutAll);

export default router;
