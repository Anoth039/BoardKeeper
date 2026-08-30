import { Router } from "express";
import { getAllGameCopies, getGameCopyById, createGameCopy, updateGameCopy, deleteGameCopy, createGameCopiesBulk, getCopyAuditLog } from "../controllers/gameCopyController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllGameCopies);
router.get("/:id", getGameCopyById);
router.get("/audit/:gameId", requireAdmin, getCopyAuditLog);
router.post("/", createGameCopy);
router.post("/bulk", createGameCopiesBulk);
router.put("/:id", updateGameCopy);
router.delete("/:id", requireAdmin, deleteGameCopy);
    
export default router;