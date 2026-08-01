import { Router } from "express";
import { getStats } from "../controllers/statsController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requireAdmin, getStats);

export default router;