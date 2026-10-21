import { Router } from "express";
import { getStats } from "../controllers/statsController";
import { requirePermission } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requirePermission("stats:view"), getStats);

export default router;
