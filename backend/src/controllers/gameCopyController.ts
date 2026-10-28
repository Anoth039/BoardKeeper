import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { CopyCondition, GameCopy, MAX_RESERVATION_DAYS, MAX_ACTIVE_RESERVATIONS_PER_MEMBER, hasActiveReservation } from "../entities/GameCopy";
import { Member } from "../entities/Member";
import { dateString, toDate, toDateString } from "../utils/date";
import { Rental, RentalStatus } from "../entities/Rental";
import { Game } from "../entities/Game";
import { AuditAction, CopyAuditLog } from "../entities/CopyAuditLog";
import { User } from "../entities/User";
import { assignQueuedReservations, countMemberHolds } from "./queueController";
import { sendReservationEmail } from "../mailer";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const gameCopyRepository = AppDataSource.getRepository(GameCopy);
const gameRepository = AppDataSource.getRepository(Game);
const rentalRepository = AppDataSource.getRepository(Rental);

const auditRepo = AppDataSource.getRepository(CopyAuditLog);
const userRepo = AppDataSource.getRepository(User);

export async function logAudit(copy: GameCopy, gameId: number, action: AuditAction, oldValue: string | null, newValue: string | null, userId: number | null): Promise<void> {
  const performedBy = userId ? await userRepo.findOneBy({ id: userId }) : null;
  const log = auditRepo.create({ copy, copyNumberSnapshot: copy.copyNumber, gameId, action, oldValue, newValue, performedBy });
  await auditRepo.save(log);
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const findDuplicateCopyNumber = (gameId: number, copyNumber: string, excludeId?: number) => {
  const query = gameCopyRepository
    .createQueryBuilder("copy")
    .where("copy.game.id = :gameId", { gameId })
    .andWhere("LOWER(copy.copyNumber) = LOWER(:copyNumber)", { copyNumber });
  if (excludeId !== undefined) query.andWhere("copy.id != :excludeId", { excludeId });
  return query.getOne();
};

export const getAllGameCopies = async (req: Request, res: Response) => {
  try {
    const copies = await gameCopyRepository.find({ relations: { game: true, reservedFor: true } });
    res.json(copies);
  } catch (error) {
    console.error("Failed to fetch game copies:", error);
    res.status(500).json({ message: "Failed to fetch game copies" });
  }
};

export const getGameCopyById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { game: true, reservedFor: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "Game copy not found" });
    }

    res.json(copy);
  } catch (error) {
    console.error("Failed to fetch game copy:", error);
    res.status(500).json({ message: "Failed to fetch game copy" });
  }
};

export const createGameCopy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId, copyNumber, condition } = req.body;

    if (!gameId || !copyNumber) {
      return res.status(400).json({ message: "gameId and copyNumber are required" });
    }

    const trimmed = copyNumber.trim();
    if (trimmed.length < 3 || trimmed.length > 12) {
      return res.status(400).json({ message: "copyNumber must be between 3 and 12 characters" });
    }

    const game = await gameRepository.findOneBy({ id: gameId });
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (await findDuplicateCopyNumber(gameId, trimmed)) {
      return res.status(409).json({ message: `A copy named "${trimmed}" already exists for this game` });
    }

    const copy = gameCopyRepository.create({
      game,
      copyNumber: trimmed,
      condition: condition || "good",
    });

    const saved = await gameCopyRepository.save(copy);

    await logAudit(saved, game.id, AuditAction.CREATED, null, `Condition: ${saved.condition}`, req.user?.userId ?? null);
    await assignQueuedReservations();

    const finalCopy = await gameCopyRepository.findOne({ where: { id: saved.id }, relations: { reservedFor: true } });
    res.status(201).json(finalCopy);
  } catch (error) {
    console.error("Failed to create copy:", error);
    res.status(500).json({ message: "Failed to create copy" });
  }
};

export const createGameCopiesBulk = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId, condition, prefix, startNumber, quantity } = req.body;

    if (!gameId || !prefix?.trim() || !quantity || quantity < 1 || quantity > 20) {
      return res.status(400).json({ message: "gameId, prefix, and quantity (1–20) are required" });
    }

    const game = await gameRepository.findOneBy({ id: gameId });
    if (!game) return res.status(404).json({ message: "Game not found" });

    const copies = [];
    const duplicates: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const copyNumber = `${prefix.trim()}-${String((startNumber || 1) + i).padStart(2, '0')}`;

      if (copyNumber.length > 12) {
        return res.status(400).json({
          message: `Generated name "${copyNumber}" exceeds 12 characters. Use a shorter prefix.`
        });
      }

      if (await findDuplicateCopyNumber(gameId, copyNumber)) duplicates.push(copyNumber);
      else copies.push(gameCopyRepository.create({ game, condition, copyNumber }));
    }

    if (duplicates.length > 0) {
      return res.status(409).json({
        message: `Already exist: ${duplicates.join(', ')}. Adjust your prefix.`
      });
    }

    const saved = await gameCopyRepository.save(copies);

    for (const copy of saved) {
      await logAudit(copy, gameId, AuditAction.CREATED, null, `Condition: ${copy.condition}`, req.user?.userId ?? null);
    }
    await assignQueuedReservations();

    const finalCopies = await gameCopyRepository.find({ where: { id: In(saved.map(c => c.id)) }, relations: { reservedFor: true } });
    const byId = new Map(finalCopies.map(c => [c.id, c]));
    res.status(201).json(saved.map(c => byId.get(c.id)));
  } catch (error) {
    console.error("Failed to create copies:", error);
    res.status(500).json({ message: "Failed to create copies" });
  }
};

export const updateGameCopy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { game: true, reservedFor: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "GameCopy not found" });
    }

    if (hasActiveReservation(copy)) {
      return res.status(409).json({ message: "This copy is reserved. Cancel the reservation before editing it." });
    }

    const { copyNumber, condition, notes } = req.body;
    const userId = req.user?.userId ?? null;
    const gameId = copy.game.id;

    if (copyNumber !== undefined && copyNumber.trim() !== copy.copyNumber) {
      const trimmed = copyNumber.trim();
      if (trimmed.length < 3 || trimmed.length > 12) {
        return res.status(400).json({ message: "copyNumber must be between 3 and 12 characters" });
      }
      if (await findDuplicateCopyNumber(gameId, trimmed, copy.id)) {
        return res.status(409).json({ message: `A copy named "${trimmed}" already exists for this game` });
      }
      await logAudit(copy, gameId, AuditAction.NAME_CHANGED, copy.copyNumber, trimmed, userId);
      copy.copyNumber = trimmed;
    }

    if (condition !== undefined && condition !== copy.condition) {
      await logAudit(copy, gameId, AuditAction.CONDITION_CHANGED, copy.condition, condition, userId);
      const wasLost = copy.condition === CopyCondition.LOST;
      copy.condition = condition;

      if (condition === CopyCondition.LOST) {
        copy.isAvailable = false;
      } else if (wasLost) {
        const activeRentals = await rentalRepository.count({
          where: { gameCopy: { id }, status: RentalStatus.ACTIVE },
        });
        copy.isAvailable = activeRentals === 0;
      }
    }

    if (notes !== undefined && notes !== copy.notes) {
      await logAudit(copy, gameId, AuditAction.NOTES_CHANGED, copy.notes || null, notes || null, userId);
      copy.notes = notes;
    }

    const updated = await gameCopyRepository.save(copy);
    await assignQueuedReservations();
    res.json(updated);
  } catch (error) {
    console.error("Failed to update copy:", error);
    res.status(500).json({ message: "Failed to update copy" });
  }
};

export const deleteGameCopy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { rentals: true, game: true, reservedFor: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "GameCopy not found" });
    }

    if (hasActiveReservation(copy)) {
      return res.status(409).json({ message: "This copy is reserved. Cancel the reservation before deleting it." });
    }

    const hasActiveRentals = copy.rentals?.some(r => r.status === "active");
    if (hasActiveRentals) {
      return res.status(409).json({ message: "Cannot delete a copy that is currently rented out" });
    }

    await logAudit(copy, copy.game.id, AuditAction.DELETED, copy.condition, null, req.user?.userId ?? null);

    await gameCopyRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete copy:", error);
    res.status(500).json({ message: "Failed to delete copy" });
  }
};

export const reserveGameCopy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { memberId, reservedUntil } = req.body;

    if (!memberId || !reservedUntil) {
      return res.status(400).json({ message: "memberId and reservedUntil are required" });
    }
    if (typeof reservedUntil !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reservedUntil) || toDateString(toDate(reservedUntil)) !== reservedUntil) {
      return res.status(400).json({ message: "reservedUntil must be a valid date (YYYY-MM-DD)" });
    }
    if (reservedUntil < dateString() || reservedUntil > dateString(MAX_RESERVATION_DAYS)) {
      return res.status(400).json({ message: `A reservation can last from today up to ${MAX_RESERVATION_DAYS} days` });
    }

    const { copy, member, saved } = await AppDataSource.transaction(async (manager) => {
      const copyRepo = manager.getRepository(GameCopy);
      const memberRepo = manager.getRepository(Member);

      const lockedCopy = await copyRepo.findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      const member = await memberRepo.findOne({ where: { id: Number(memberId) }, lock: { mode: "pessimistic_write" } });

      const copy = lockedCopy && await copyRepo.findOne({ where: { id }, relations: { game: true, reservedFor: true } });
      if (!copy) {
        throw new HttpError(404, "Game copy not found");
      }
      if (!member) {
        throw new HttpError(404, "Member not found");
      }
      if (!member.isActive) {
        throw new HttpError(409, "Inactive members cannot reserve copies");
      }
      if (copy.condition === CopyCondition.LOST) {
        throw new HttpError(409, "A lost copy cannot be reserved");
      }
      if (!copy.isAvailable) {
        throw new HttpError(409, "Only copies that are in the library can be reserved");
      }
      if (hasActiveReservation(copy)) {
        throw new HttpError(409, `This copy is already reserved for ${copy.reservedFor!.firstName} ${copy.reservedFor!.lastName}`);
      }
      if ((await countMemberHolds(member.id, manager)) >= MAX_ACTIVE_RESERVATIONS_PER_MEMBER) {
        throw new HttpError(409, `${member.firstName} ${member.lastName} already has ${MAX_ACTIVE_RESERVATIONS_PER_MEMBER} active reservations / queue spots`);
      }

      copy.reservedFor = member;
      copy.reservedUntil = reservedUntil;
      return { copy, member, saved: await copyRepo.save(copy) };
    });

    await logAudit(copy, copy.game.id, AuditAction.RESERVED, null, `${member.firstName} ${member.lastName} until ${reservedUntil}`, req.user?.userId ?? null);
    sendReservationEmail(member.email, member.firstName, copy.game.title, copy.copyNumber, reservedUntil)
      .catch(err => console.error("Failed to send reservation email:", err));
    res.json(saved);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Failed to reserve copy:", error);
    res.status(500).json({ message: "Failed to reserve copy" });
  }
};

export const cancelReservation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { game: true, reservedFor: true },
    });
    if (!copy) {
      return res.status(404).json({ message: "Game copy not found" });
    }
    if (!hasActiveReservation(copy)) {
      return res.status(409).json({ message: "This copy is not reserved" });
    }

    const holder = `${copy.reservedFor!.firstName} ${copy.reservedFor!.lastName} until ${copy.reservedUntil}`;
    copy.reservedFor = null;
    copy.reservedUntil = null;
    const saved = await gameCopyRepository.save(copy);

    await logAudit(copy, copy.game.id, AuditAction.RESERVATION_CANCELLED, holder, null, req.user?.userId ?? null);
    await assignQueuedReservations();
    res.json(saved);
  } catch (error) {
    console.error("Failed to cancel reservation:", error);
    res.status(500).json({ message: "Failed to cancel reservation" });
  }
};

export const getCopyAuditLog = async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.gameId);

    const logs = await auditRepo
      .createQueryBuilder("log")
      .leftJoinAndSelect("log.performedBy", "user")
      .where("log.game_id = :gameId", { gameId })
      .orderBy("log.created_at", "DESC")
      .getMany();

    res.json(logs.map(log => ({
      id: log.id,
      copyNumber: log.copyNumberSnapshot,
      action: log.action,
      oldValue: log.oldValue,
      newValue: log.newValue,
      performedBy: log.performedBy ? { email: log.performedBy.email } : null,
      createdAt: log.createdAt,
    })));
  } catch (error) {
    console.error("Failed to fetch audit log:", error);
    res.status(500).json({ message: "Failed to fetch audit log" });
  }
};