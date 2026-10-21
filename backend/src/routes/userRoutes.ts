import { Router } from "express";
import { getAllUsers, toggleUserApproval, deleteUser } from "../controllers/userController";
import { requirePermission } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requirePermission("users:manage"), getAllUsers);
router.patch("/:id/toggle-approval", requirePermission("users:manage"), toggleUserApproval);
router.delete("/:id", requirePermission("users:manage"), deleteUser);

export default router;
