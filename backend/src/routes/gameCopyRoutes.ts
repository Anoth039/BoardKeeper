import { Router } from "express";
import { getAllGameCopies, getGameCopyById, createGameCopy, updateGameCopy, deleteGameCopy } from "../controllers/gameCopyController";

const router = Router();

router.get("/", getAllGameCopies);
router.get("/:id", getGameCopyById);
router.post("/", createGameCopy);
router.put("/:id", updateGameCopy);
router.delete("/:id", deleteGameCopy);

export default router;