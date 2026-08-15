import { Router } from "express";
import { getAllGameCopies, getGameCopyById, createGameCopy, updateGameCopy, deleteGameCopy, createGameCopiesBulk } from "../controllers/gameCopyController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllGameCopies);
router.get("/:id", getGameCopyById);
router.post("/", requireAdmin, createGameCopy);
router.post("/bulk", requireAdmin, createGameCopiesBulk);
router.put("/:id", requireAdmin, updateGameCopy);
router.delete("/:id", requireAdmin, deleteGameCopy);
    
export default router;