import { Router } from "express";
import { getAllUsers, toggleUserApproval, deleteUser } from "../controllers/userController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requireAdmin, getAllUsers);
router.patch("/:id/toggle-approval", requireAdmin, toggleUserApproval);
router.delete("/:id", requireAdmin, deleteUser);

export default router;