import { Router } from "express";
import { getAllRentals, getRentalById, createRental, returnRental, deleteRental } from "../controllers/rentalController";

const router = Router();

router.get("/", getAllRentals);
router.get("/:id", getRentalById);
router.post("/", createRental);
router.put("/:id/return", returnRental);
router.delete("/:id", deleteRental);

export default router;