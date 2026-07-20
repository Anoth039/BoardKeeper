import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Rental, RentalStatus } from "../entities/Rental";
import { GameCopy } from "../entities/GameCopy";
import { Member } from "../entities/Member";

const rentalRepository = AppDataSource.getRepository(Rental);

// GET /api/rentals
export const getAllRentals = async (req: Request, res: Response) => {
  try {
    const rentals = await rentalRepository.find({
      relations: { member: true, gameCopy: { game: true } },
    });
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch rentals", error });
  }
};

// GET /api/rentals/:id
export const getRentalById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const rental = await rentalRepository.findOne({
      where: { id },
      relations: { member: true, gameCopy: { game: true } },
    });

    if (!rental) {
      return res.status(404).json({ message: "Rental not found" });
    }

    res.json(rental);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch rental", error });
  }
};

// POST /api/rentals
export const createRental = async (req: Request, res: Response) => {
  try {
    const { memberId, gameCopyId, rentalDate, dueDate } = req.body;

    if (!memberId || !gameCopyId || !rentalDate || !dueDate) {
      return res.status(400).json({
        message: "memberId, gameCopyId, rentalDate, and dueDate are required",
      });
    }

    const savedRental = await AppDataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(Member);
      const gameCopyRepo = manager.getRepository(GameCopy);
      const rentalRepo = manager.getRepository(Rental);

      const member = await memberRepo.findOneBy({ id: memberId });
      if (!member) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      const gameCopy = await gameCopyRepo.findOneBy({ id: gameCopyId });
      if (!gameCopy) {
        throw new Error("COPY_NOT_FOUND");
      }
      if (!gameCopy.isAvailable) {
        throw new Error("COPY_NOT_AVAILABLE");
      }

      const rental = rentalRepo.create({
        member,
        gameCopy,
        rentalDate,
        dueDate,
        status: RentalStatus.ACTIVE,
      });
      const newRental = await rentalRepo.save(rental);

      gameCopy.isAvailable = false;
      await gameCopyRepo.save(gameCopy);

      return newRental;
    });

    res.status(201).json(savedRental);
  } catch (error: any) {
    if (error.message === "MEMBER_NOT_FOUND") {
      return res.status(404).json({ message: "Member not found" });
    }
    if (error.message === "COPY_NOT_FOUND") {
      return res.status(404).json({ message: "Game copy not found" });
    }
    if (error.message === "COPY_NOT_AVAILABLE") {
      return res.status(409).json({ message: "This copy is not available for rent" });
    }
    res.status(500).json({ message: "Failed to create rental", error });
  }
};

// PUT /api/rentals/:id/return
export const returnRental = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const updatedRental = await AppDataSource.transaction(async (manager) => {
      const rentalRepo = manager.getRepository(Rental);
      const gameCopyRepo = manager.getRepository(GameCopy);

      const rental = await rentalRepo.findOne({
        where: { id },
        relations: { gameCopy: true },
      });

      if (!rental) {
        throw new Error("RENTAL_NOT_FOUND");
      }
      if (rental.status === RentalStatus.RETURNED) {
        throw new Error("ALREADY_RETURNED");
      }

      rental.status = RentalStatus.RETURNED;
      rental.returnDate = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
      const savedRental = await rentalRepo.save(rental);

      rental.gameCopy.isAvailable = true;
      await gameCopyRepo.save(rental.gameCopy);

      return savedRental;
    });

    res.json(updatedRental);
  } catch (error: any) {
    if (error.message === "RENTAL_NOT_FOUND") {
      return res.status(404).json({ message: "Rental not found" });
    }
    if (error.message === "ALREADY_RETURNED") {
      return res.status(409).json({ message: "This rental has already been returned" });
    }
    res.status(500).json({ message: "Failed to return rental", error });
  }
};

// DELETE /api/rentals/:id
export const deleteRental = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await rentalRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ message: "Rental not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete rental", error });
  }
};