import { Router } from "express";
import { getAllGames, getGameById, createGame, updateGame, deleteGame } from "../controllers/gameController";
import { requireAdmin } from "../middleware/authMiddleware";
import { getQueue, joinQueue, leaveQueue } from "../controllers/queueController";

const router = Router();

router.get("/", getAllGames);
router.get("/:id", getGameById);
router.get("/:id/queue", getQueue);
router.post("/:id/queue", joinQueue);
router.delete("/:id/queue/:entryId", leaveQueue);
router.post("/", requireAdmin, createGame);
router.put("/:id", requireAdmin, updateGame);
router.delete("/:id", requireAdmin, deleteGame);

export default router;