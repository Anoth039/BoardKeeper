import { Router } from "express";
import { getAllMembers, getMemberById, createMember, updateMember, deleteMember } from "../controllers/memberController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllMembers);
router.get("/:id", getMemberById);
router.post("/", createMember);
router.put("/:id", updateMember);
router.delete("/:id", requireAdmin, deleteMember);
    
export default router;