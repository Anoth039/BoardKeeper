import { Router } from "express";
import { getAllMembers, getMemberById, createMember, updateMember, deleteMember } from "../controllers/memberController";
import { requirePermission } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requirePermission("members:read"), getAllMembers);
router.get("/:id", requirePermission("members:read"), getMemberById);
router.post("/", requirePermission("members:write"), createMember);
router.put("/:id", requirePermission("members:write"), updateMember);
router.delete("/:id", requirePermission("members:delete"), deleteMember);

export default router;
