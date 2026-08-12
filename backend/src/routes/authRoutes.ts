import { Router } from "express";
import { register, login, resetPassword, forgotPassword, sendVerificationCode } from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/send-verification-code", sendVerificationCode);

export default router;