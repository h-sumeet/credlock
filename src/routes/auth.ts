import { Router } from "express";
import { authenticate, clientContext } from "../middleware/auth";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  tokenHeaderSchema,
  updateProfileSchema,
  validate,
  emailVerifyToken,
  verifyEmailSchema,
} from "../middleware/validation";
import {
  deleteAccount,
  forgotPassword,
  getProfile,
  login,
  logout,
  logoutAll,
  refreshToken,
  register,
  resetPassword,
  updateEmail,
  updateProfile,
  verifyEmail,
} from "../controllers/UserController";


const router = Router();
router.use(clientContext)

// Public routes
router.post("/signup", validate(registerSchema), register);
router.post("/signin", validate(loginSchema), login);
router.post(
  "/refresh-token",
  validate(refreshTokenSchema, "headers"),
  refreshToken
);
router.post("/verify-email", validate(emailVerifyToken), verifyEmail);
router.post("/forgot-password", validate(verifyEmailSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// Protected routes require authentication
router.use(validate(tokenHeaderSchema, "headers"), authenticate);

router.get("/profile", getProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);
router.put("/update-email", validate(verifyEmailSchema), updateEmail);

router.post("/logout", logout);
router.post("/logout-all", logoutAll);
router.delete("/delete-account", deleteAccount);

export default router;
