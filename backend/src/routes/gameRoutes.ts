import { Router } from "express";
import { getAllGames, getGameById, createGame, updateGame, deleteGame } from "../controllers/gameController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllGames);
router.get("/:id", getGameById);
router.post("/", requireAdmin, createGame);
router.put("/:id", requireAdmin, updateGame);
router.delete("/:id", requireAdmin, deleteGame);

export default router;