import { Router } from "express";
import { getAllRentals, getRentalById, createRental, returnRental, deleteRental, markRentalLost, extendRental } from "../controllers/rentalController";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getAllRentals);
router.get("/:id", getRentalById);
router.post("/", createRental);
router.put("/:id/return", returnRental);
router.put("/:id/extend", extendRental);
router.put("/:id/lost", markRentalLost);
router.delete("/:id", requireAdmin, deleteRental);

export default router;