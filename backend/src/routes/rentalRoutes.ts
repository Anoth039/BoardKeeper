import { Router } from "express";
import { getAllRentals, getRentalById, createRental, returnRental, deleteRental, markRentalLost } from "../controllers/rentalController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllRentals);
router.get("/:id", getRentalById);
router.post("/", createRental);
router.put("/:id/return", returnRental);
router.put("/:id/lost", requireAdmin, markRentalLost);
router.delete("/:id", deleteRental);

export default router;