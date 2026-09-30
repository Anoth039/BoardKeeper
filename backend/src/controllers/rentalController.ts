import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Rental, RentalStatus } from "../entities/Rental";
import { GameCopy, hasActiveReservation, MAX_ACTIVE_RENTALS_PER_MEMBER } from "../entities/GameCopy";
import { Member } from "../entities/Member";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { User } from "../entities/User";
import { RentalExtension } from "../entities/RentalExtension";
import { assignQueuedReservations } from "./queueController";
import { dateString, daysBetween } from "../utils/date";
import { effectiveDailyRate, LATE_FEE_RATE_MULTIPLIER, EXTENSION_FEE } from "../utils/pricing";
import { round2 } from "../utils/money";
import { LessThan } from "typeorm";

const rentalRepository = AppDataSource.getRepository(Rental);

export const getAllRentals = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === "admin";

    const rentals = await rentalRepository.find({
      relations: { 
        member: true, gameCopy: { game: true }, ...(isAdmin ? { handledBy: true, returnedBy: true } : {}), extensions: { extendedBy: true }
      },
    });

    res.json(rentals);
  } catch (error) {
    console.error("Failed to fetch rentals:", error);
    res.status(500).json({ message: "Failed to fetch rentals" });
  }
};

export const getRentalById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === "admin";

    const id = Number(req.params.id);
    const rental = await rentalRepository.findOne({
      where: { id },
      relations: { member: true, gameCopy: { game: true }, ...(isAdmin ? { handledBy: true, returnedBy: true } : {}) },
    });

    if (!rental) {
      return res.status(404).json({ message: "Rental not found" });
    }

    res.json(rental);
  } catch (error) {
    console.error("Failed to fetch rental:", error);
    res.status(500).json({ message: "Failed to fetch rental" });
  }
};

export const createRental = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { memberId, gameCopyId, rentalDate, dueDate } = req.body;
    await assignQueuedReservations();

    if (!memberId || !gameCopyId || !rentalDate || !dueDate) {
      return res.status(400).json({
        message: "memberId, gameCopyId, rentalDate, and dueDate are required",
      });
    }

    const savedRental = await AppDataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(Member);
      const gameCopyRepo = manager.getRepository(GameCopy);
      const rentalRepo = manager.getRepository(Rental);
      const userRepo = manager.getRepository(User);

      const member = await memberRepo.findOneBy({ id: memberId });
      if (!member) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      if (!member.isActive) throw new Error("MEMBER_INACTIVE");
      
      const overdue = await rentalRepo.count({
        where: { member: { id: memberId }, status: RentalStatus.ACTIVE, dueDate: LessThan(dateString()) },
      });
      if (overdue > 0) throw new Error("MEMBER_HAS_OVERDUE");

      const activeRentalCount = await rentalRepo.count({
        where: { member: { id: memberId }, status: RentalStatus.ACTIVE }
      });

      if (activeRentalCount >= MAX_ACTIVE_RENTALS_PER_MEMBER) {
        throw new Error("RENTAL_LIMIT_REACHED");
      }

      const gameCopy = await gameCopyRepo.findOne({
        where: { id: gameCopyId },
        relations: { game: true, reservedFor: true },
      });
      if (!gameCopy) {
        throw new Error("COPY_NOT_FOUND");
      }
      if (!gameCopy.isAvailable) {
        throw new Error("COPY_NOT_AVAILABLE");
      }
      if (gameCopy.condition === "lost") {
        throw new Error("COPY_LOST");
      }
      if (hasActiveReservation(gameCopy) && gameCopy.reservedFor!.id !== member.id) {
        throw Object.assign(new Error("COPY_RESERVED"), { reservedUntil: gameCopy.reservedUntil });
      }

      const handledByUser = req.user
        ? await userRepo.findOneBy({ id: req.user.userId })
        : null;

      const rental = rentalRepo.create({
        member,
        gameCopy,
        rentalDate,
        dueDate,
        originalDueDate: dueDate,
        status: RentalStatus.ACTIVE,
        gameTitleSnapshot: gameCopy.game?.title,
        copyLabelSnapshot: gameCopy.copyNumber,
        pricePerDaySnapshot: effectiveDailyRate(gameCopy.game?.pricePerDay, gameCopy.condition),
        handledBy: handledByUser,
      });
      const newRental = await rentalRepo.save(rental);

      gameCopy.isAvailable = false;
      gameCopy.reservedFor = null;
      gameCopy.reservedUntil = null;
      await gameCopyRepo.save(gameCopy);

      return newRental;
    });

    res.status(201).json(savedRental);
  } catch (error: any) {
    if (error.message === "MEMBER_NOT_FOUND") {
      return res.status(404).json({ message: "Member not found" });
    }
    if (error.message === "MEMBER_INACTIVE") {
      return res.status(409).json({ message: "Inactive members cannot rent games" });
    }
    if (error.message === "MEMBER_HAS_OVERDUE") {
      return res.status(409).json({ message: "This member has an overdue rental. Please return it first." });
    }
    if (error.message === "RENTAL_LIMIT_REACHED") {
      return res.status(409).json({ message: `This member already has ${MAX_ACTIVE_RENTALS_PER_MEMBER} active rentals. Please return one before renting another.` });
    }
    if (error.message === "COPY_NOT_FOUND") {
      return res.status(404).json({ message: "Game copy not found" });
    }
    if (error.message === "COPY_NOT_AVAILABLE") {
      return res.status(409).json({ message: "This copy is not available for rent" });
    }
    if (error.message === "COPY_LOST") {
      return res.status(409).json({ message: "This copy is marked as lost and cannot be rented" });
    }
    if (error.message === "COPY_RESERVED") {
      return res.status(409).json({ message: `This copy is reserved for another member until ${error.reservedUntil}` });
    }
    console.error("Failed to create rental:", error);
    res.status(500).json({ message: "Failed to create rental" });
  }
};

export const returnRental = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    const updatedRental = await AppDataSource.transaction(async (manager) => {
      const rentalRepo = manager.getRepository(Rental);
      const gameCopyRepo = manager.getRepository(GameCopy);
      const userRepo = manager.getRepository(User);

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
      if (rental.status !== RentalStatus.ACTIVE) {
        throw new Error("NOT_ACTIVE");
      }
      if (!rental.gameCopy) {
        throw new Error("COPY_NO_LONGER_EXISTS");
      }

      const returnedByUser = req.user
        ? await userRepo.findOneBy({ id: req.user.userId })
        : null;

      const today = dateString();
      const daysRented = Math.max(1, daysBetween(rental.rentalDate, today));
      const lateDays = Math.max(0, daysBetween(rental.dueDate, today));
      const rate = rental.pricePerDaySnapshot || 0;

      rental.rentalCharge = round2(rate * daysRented);
      rental.lateFeeCharged = lateDays > 0 ? round2(rate * LATE_FEE_RATE_MULTIPLIER * lateDays) : 0;
      rental.totalCharged = round2(rental.rentalCharge + rental.lateFeeCharged + (rental.extensionFeeCharged || 0));

      rental.status = RentalStatus.RETURNED;
      rental.returnDate = today;
      rental.returnedBy = returnedByUser;
      const savedRental = await rentalRepo.save(rental);

      rental.gameCopy.isAvailable = true;
      await gameCopyRepo.save(rental.gameCopy);

      return savedRental;
    });

    await assignQueuedReservations();
    res.json(updatedRental);
  } catch (error: any) {
    if (error.message === "RENTAL_NOT_FOUND") {
      return res.status(404).json({ message: "Rental not found" });
    }
    if (error.message === "ALREADY_RETURNED") {
      return res.status(409).json({ message: "This rental has already been returned" });
    }
    if (error.message === "NOT_ACTIVE") {
      return res.status(409).json({ message: "Only active rentals can be returned" });
    }
    if (error.message === "COPY_NO_LONGER_EXISTS") {
      return res.status(409).json({ message: "This rental's copy no longer exists and cannot be marked as returned this way" });
    }
    console.error("Failed to return rental:", error);
    res.status(500).json({ message: "Failed to return rental" });
  }
};

export const extendRental = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { newDueDate } = req.body;

    if (!newDueDate) {
      return res.status(400).json({ message: "newDueDate is required" });
    }

    const updated = await AppDataSource.transaction(async (manager) => {
      const rentalRepo = manager.getRepository(Rental);
      const extensionRepo = manager.getRepository(RentalExtension);
      const userRepo = manager.getRepository(User);

      const rental = await rentalRepo.findOneBy({ id });
      if (!rental) {
        throw new Error("RENTAL_NOT_FOUND");
      }
      if (rental.status !== RentalStatus.ACTIVE) {
        throw new Error("NOT_ACTIVE");
      }
      if (daysBetween(rental.dueDate, dateString()) > 0) {
        throw new Error("RENTAL_OVERDUE");
      }
      if (newDueDate <= rental.dueDate) {
        throw new Error("INVALID_DUE_DATE");
      }

      const extendedByUser = req.user
        ? await userRepo.findOneBy({ id: req.user.userId })
        : null;

      const extension = extensionRepo.create({
        rental,
        previousDueDate: rental.dueDate,
        newDueDate,
        feeCharged: EXTENSION_FEE,
        extendedBy: extendedByUser,
      });
      await extensionRepo.save(extension);

      rental.dueDate = newDueDate;
      rental.extensionFeeCharged = round2((rental.extensionFeeCharged || 0) + EXTENSION_FEE);
      return rentalRepo.save(rental);
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message === "RENTAL_NOT_FOUND") {
      return res.status(404).json({ message: "Rental not found" });
    }
    if (error.message === "NOT_ACTIVE") {
      return res.status(409).json({ message: "Only active rentals can be extended" });
    }
    if (error.message === "RENTAL_OVERDUE") {
      return res.status(409).json({ message: "This rental is already overdue and cannot be extended. Please return it or mark it as lost instead." });
    }
    if (error.message === "INVALID_DUE_DATE") {
      return res.status(400).json({ message: "New due date must be after the current due date" });
    }
    console.error("Failed to extend rental:", error);
    res.status(500).json({ message: "Failed to extend rental" });
  }
};

export const markRentalLost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    const updatedRental = await AppDataSource.transaction(async (manager) => {
      const rentalRepo = manager.getRepository(Rental);
      const gameCopyRepo = manager.getRepository(GameCopy);
      const userRepo = manager.getRepository(User);

      const rental = await rentalRepo.findOne({
        where: { id },
        relations: { gameCopy: { game: true } },
      });

      if (!rental) {
        throw new Error("RENTAL_NOT_FOUND");
      }
      if (rental.status !== RentalStatus.ACTIVE) {
        throw new Error("NOT_ACTIVE");
      }
      if (!rental.gameCopy) {
        throw new Error("COPY_NO_LONGER_EXISTS");
      }

      const returnedByUser = req.user
        ? await userRepo.findOneBy({ id: req.user.userId })
        : null;

      rental.gameCopy.condition = "lost" as any;
      rental.gameCopy.isAvailable = false;
      await gameCopyRepo.save(rental.gameCopy);

      const today = dateString();
      const daysRented = Math.max(1, daysBetween(rental.rentalDate, today));
      const lateDays = Math.max(0, daysBetween(rental.dueDate, today));
      const rate = rental.pricePerDaySnapshot || 0;

      rental.rentalCharge = round2(rate * daysRented);
      rental.lateFeeCharged = lateDays > 0 ? round2(rate * LATE_FEE_RATE_MULTIPLIER * lateDays) : 0;
      rental.replacementFeeCharged = round2(rental.gameCopy.game?.replacementValue || 0);
      rental.totalCharged = round2(
        rental.rentalCharge + rental.lateFeeCharged + (rental.extensionFeeCharged || 0) + rental.replacementFeeCharged
      );

      rental.status = RentalStatus.LOST;
      rental.returnDate = today;
      rental.returnedBy = returnedByUser;
      const savedRental = await rentalRepo.save(rental);

      return savedRental;
    });

    res.json(updatedRental);
  } catch (error: any) {
    if (error.message === "RENTAL_NOT_FOUND") {
      return res.status(404).json({ message: "Rental not found" });
    }
    if (error.message === "NOT_ACTIVE") {
      return res.status(409).json({ message: "Only active rentals can be marked as lost" });
    }
    if (error.message === "COPY_NO_LONGER_EXISTS") {
      return res.status(409).json({ message: "This rental's copy no longer exists" });
    }
    console.error("Failed to mark rental as lost:", error);
    res.status(500).json({ message: "Failed to mark rental as lost" });
  }
};

export const deleteRental = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await rentalRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ message: "Rental not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete rental:", error);
    res.status(500).json({ message: "Failed to delete rental" });
  }
};