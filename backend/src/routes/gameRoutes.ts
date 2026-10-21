import { Router } from "express";
import { getAllGames, getGameById, createGame, updateGame, deleteGame } from "../controllers/gameController";
import { requirePermission } from "../middleware/authMiddleware";
import { getQueue, joinQueue, leaveQueue } from "../controllers/queueController";

const router = Router();

router.get("/", requirePermission("games:read"), getAllGames);
router.get("/:id", requirePermission("games:read"), getGameById);
router.get("/:id/queue", requirePermission("queue:read"), getQueue);
router.post("/:id/queue", requirePermission("queue:manage"), joinQueue);
router.delete("/:id/queue/:entryId", requirePermission("queue:manage"), leaveQueue);
router.post("/", requirePermission("games:write"), createGame);
router.put("/:id", requirePermission("games:write"), updateGame);
router.delete("/:id", requirePermission("games:write"), deleteGame);

export default router;
