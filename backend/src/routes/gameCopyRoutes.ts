import { Router } from "express";
import { getAllGameCopies, getGameCopyById, createGameCopy, updateGameCopy, deleteGameCopy, createGameCopiesBulk, getCopyAuditLog, reserveGameCopy, cancelReservation } from "../controllers/gameCopyController";
import { requirePermission } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requirePermission("copies:read"), getAllGameCopies);
router.get("/:id", requirePermission("copies:read"), getGameCopyById);
router.get("/audit/:gameId", requirePermission("copies:audit"), getCopyAuditLog);
router.post("/", requirePermission("copies:write"), createGameCopy);
router.post("/bulk", requirePermission("copies:write"), createGameCopiesBulk);
router.put("/:id/reserve", requirePermission("copies:reserve"), reserveGameCopy);
router.delete("/:id/reserve", requirePermission("copies:reserve"), cancelReservation);
router.put("/:id", requirePermission("copies:write"), updateGameCopy);
router.delete("/:id", requirePermission("copies:write"), deleteGameCopy);

export default router;
