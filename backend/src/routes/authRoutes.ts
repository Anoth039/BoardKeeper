import { Router } from "express";
import { register, login, resetPassword, forgotPassword, sendVerificationCode, me } from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/send-verification-code", sendVerificationCode);
router.get("/me", requireAuth, me);

export default router;