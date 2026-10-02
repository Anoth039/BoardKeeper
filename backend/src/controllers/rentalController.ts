import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Rental, RentalStatus } from "../entities/Rental";
import { CopyCondition, GameCopy, hasActiveReservation, MAX_ACTIVE_RENTALS_PER_MEMBER } from "../entities/GameCopy";
import { Member } from "../entities/Member";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { User } from "../entities/User";
import { RentalExtension } from "../entities/RentalExtension";
import { assignQueuedReservations } from "./queueController";
import { logAudit } from "./gameCopyController";
import { AuditAction } from "../entities/CopyAuditLog";
import { dateString, daysBetween } from "../utils/date";
import { calculateCharges, effectiveDailyRate, EXTENSION_FEE } from "../utils/pricing";
import { round2 } from "../utils/money";
import { LessThan } from "typeorm";

const rentalRepository = AppDataSource.getRepository(Rental);

const CONDITION_ORDER = [CopyCondition.NEW, CopyCondition.GOOD, CopyCondition.WORN, CopyCondition.DAMAGED];

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

export const getRentalCharges = async (req: Request, res: Response) => {
  try {
    const rental = await rentalRepository.findOneBy({ id: Number(req.params.id) });
    if (!rental) {
      return res.status(404).json({ message: "Rental not found" });
    }
    if (rental.status !== RentalStatus.ACTIVE) {
      return res.status(409).json({ message: "Only active rentals have charges due" });
    }

    res.json(calculateCharges({
      rentalDate: rental.rentalDate,
      dueDate: rental.dueDate,
      returnDate: dateString(),
      ratePerDay: rental.pricePerDaySnapshot,
      extensionFeeCharged: rental.extensionFeeCharged,
    }));
  } catch (error) {
    console.error("Failed to calculate rental charges:", error);
    res.status(500).json({ message: "Failed to calculate rental charges" });
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
        return res.status(404).json({ message: "Member not found" });
      }
      if (!member.isActive) {
        return res.status(409).json({ message: "Inactive members cannot rent games" });
      }

      const overdue = await rentalRepo.count({
        where: { member: { id: memberId }, status: RentalStatus.ACTIVE, dueDate: LessThan(dateString()) },
      });
      if (overdue > 0) {
        return res.status(409).json({ message: "This member has an overdue rental. Please return it first." });
      }

      const activeRentalCount = await rentalRepo.count({
        where: { member: { id: memberId }, status: RentalStatus.ACTIVE }
      });

      if (activeRentalCount >= MAX_ACTIVE_RENTALS_PER_MEMBER) {
        return res.status(409).json({ message: `This member already has ${MAX_ACTIVE_RENTALS_PER_MEMBER} active rentals. Please return one before renting another.` });
      }

      const gameCopy = await gameCopyRepo.findOne({
        where: { id: gameCopyId },
        relations: { game: true, reservedFor: true },
      });
      if (!gameCopy) {
        return res.status(404).json({ message: "Game copy not found" });
      }
      if (!gameCopy.isAvailable) {
        return res.status(409).json({ message: "This copy is not available for rent" });
      }
      if (gameCopy.condition === "lost") {
        return res.status(409).json({ message: "This copy is marked as lost and cannot be rented" });
      }
      if (hasActiveReservation(gameCopy) && gameCopy.reservedFor!.id !== member.id) {
        return res.status(409).json({ message: `This copy is reserved for another member until ${gameCopy.reservedUntil}` });
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

    if (res.headersSent) return;
    res.status(201).json(savedRental);
  } catch (error) {
    console.error("Failed to create rental:", error);
    res.status(500).json({ message: "Failed to create rental" });
  }
};

export const returnRental = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { condition, notes } = req.body ?? {};

    if (condition !== undefined && (!Object.values(CopyCondition).includes(condition) || condition === CopyCondition.LOST)) {
      return res.status(400).json({ message: "Invalid condition. Use \"Mark as Lost\" for lost copies." });
    }

    let returnedCopy: GameCopy | null = null;
    const copyChanges: { action: AuditAction; oldValue: string | null; newValue: string | null }[] = [];

    const updatedRental = await AppDataSource.transaction(async (manager) => {
      const rentalRepo = manager.getRepository(Rental);
      const gameCopyRepo = manager.getRepository(GameCopy);
      const userRepo = manager.getRepository(User);

      const rental = await rentalRepo.findOne({
        where: { id },
        relations: { gameCopy: { game: true } },
      });

      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      if (rental.status === RentalStatus.RETURNED) {
        return res.status(409).json({ message: "This rental has already been returned" });
      }
      if (rental.status !== RentalStatus.ACTIVE) {
        return res.status(409).json({ message: "Only active rentals can be returned" });
      }
      if (!rental.gameCopy) {
        return res.status(409).json({ message: "This rental's copy no longer exists and cannot be marked as returned this way" });
      }
      if (condition !== undefined && CONDITION_ORDER.indexOf(condition) < CONDITION_ORDER.indexOf(rental.gameCopy.condition)) {
        return res.status(400).json({ message: "A copy's condition can only be downgraded when it is returned. Ask an admin to upgrade it." });
      }

      const returnedByUser = req.user
        ? await userRepo.findOneBy({ id: req.user.userId })
        : null;

      const today = dateString();
      const charges = calculateCharges({
        rentalDate: rental.rentalDate,
        dueDate: rental.dueDate,
        returnDate: today,
        ratePerDay: rental.pricePerDaySnapshot,
        extensionFeeCharged: rental.extensionFeeCharged,
      });
      rental.rentalCharge = charges.rentalCharge;
      rental.lateFeeCharged = charges.lateFeeCharged;
      rental.totalCharged = charges.totalCharged;

      rental.status = RentalStatus.RETURNED;
      rental.returnDate = today;
      rental.returnedBy = returnedByUser;
      const savedRental = await rentalRepo.save(rental);

      if (condition !== undefined && condition !== rental.gameCopy.condition) {
        copyChanges.push({ action: AuditAction.CONDITION_CHANGED, oldValue: rental.gameCopy.condition, newValue: condition });
        rental.gameCopy.condition = condition;
      }
      if (notes !== undefined && (notes || null) !== (rental.gameCopy.notes || null)) {
        copyChanges.push({ action: AuditAction.NOTES_CHANGED, oldValue: rental.gameCopy.notes || null, newValue: notes || null });
        rental.gameCopy.notes = notes || null;
      }

      rental.gameCopy.isAvailable = true;
      await gameCopyRepo.save(rental.gameCopy);
      returnedCopy = rental.gameCopy;

      return savedRental;
    });

    if (res.headersSent) return;
    const copy = returnedCopy as GameCopy | null;
    if (copy) {
      for (const change of copyChanges) {
        await logAudit(copy, copy.game.id, change.action, change.oldValue, change.newValue, req.user?.userId ?? null);
      }
    }
    await assignQueuedReservations();
    res.json(updatedRental);
  } catch (error) {
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
        return res.status(404).json({ message: "Rental not found" });
      }
      if (rental.status !== RentalStatus.ACTIVE) {
        return res.status(409).json({ message: "Only active rentals can be extended" });
      }
      if (daysBetween(rental.dueDate, dateString()) > 0) {
        return res.status(409).json({ message: "This rental is already overdue and cannot be extended. Please return it or mark it as lost instead." });
      }
      if (newDueDate <= rental.dueDate) {
        return res.status(400).json({ message: "New due date must be after the current due date" });
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

    if (res.headersSent) return;
    res.json(updated);
  } catch (error) {
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
        return res.status(404).json({ message: "Rental not found" });
      }
      if (rental.status !== RentalStatus.ACTIVE) {
        return res.status(409).json({ message: "Only active rentals can be marked as lost" });
      }
      if (!rental.gameCopy) {
        return res.status(409).json({ message: "This rental's copy no longer exists" });
      }

      const returnedByUser = req.user
        ? await userRepo.findOneBy({ id: req.user.userId })
        : null;

      rental.gameCopy.condition = "lost" as any;
      rental.gameCopy.isAvailable = false;
      await gameCopyRepo.save(rental.gameCopy);

      const today = dateString();
      const charges = calculateCharges({
        rentalDate: rental.rentalDate,
        dueDate: rental.dueDate,
        returnDate: today,
        ratePerDay: rental.pricePerDaySnapshot,
        extensionFeeCharged: rental.extensionFeeCharged,
        replacementFee: rental.gameCopy.game?.replacementValue,
      });
      Object.assign(rental, charges);

      rental.status = RentalStatus.LOST;
      rental.returnDate = today;
      rental.returnedBy = returnedByUser;
      const savedRental = await rentalRepo.save(rental);

      return savedRental;
    });

    if (res.headersSent) return;
    res.json(updatedRental);
  } catch (error) {
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