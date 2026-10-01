import { Router } from "express";
import { getAllGameCopies, getGameCopyById, createGameCopy, updateGameCopy, deleteGameCopy, createGameCopiesBulk, getCopyAuditLog, reserveGameCopy, cancelReservation } from "../controllers/gameCopyController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllGameCopies);
router.get("/:id", getGameCopyById);
router.get("/audit/:gameId", requireAdmin, getCopyAuditLog);
router.post("/", requireAdmin, createGameCopy);
router.post("/bulk", requireAdmin, createGameCopiesBulk);
router.put("/:id/reserve", reserveGameCopy);
router.delete("/:id/reserve", cancelReservation);
router.put("/:id", requireAdmin, updateGameCopy);
router.delete("/:id", requireAdmin, deleteGameCopy);
    
export default router;