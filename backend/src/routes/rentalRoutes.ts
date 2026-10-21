import { Router } from "express";
import { getAllRentals, getRentalById, getRentalCharges, createRental, returnRental, deleteRental, markRentalLost, extendRental } from "../controllers/rentalController";
import { requirePermission } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requirePermission("rentals:read"), getAllRentals);
router.get("/:id", requirePermission("rentals:read"), getRentalById);
router.get("/:id/charges", requirePermission("rentals:read"), getRentalCharges);
router.post("/", requirePermission("rentals:create"), createRental);
router.put("/:id/return", requirePermission("rentals:return"), returnRental);
router.put("/:id/extend", requirePermission("rentals:extend"), extendRental);
router.put("/:id/lost", requirePermission("rentals:mark_lost"), markRentalLost);
router.delete("/:id", requirePermission("rentals:delete"), deleteRental);

export default router;
