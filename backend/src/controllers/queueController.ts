import { Response } from "express";
import { MoreThanOrEqual } from "typeorm";
import { AppDataSource } from "../data-source";
import { CopyCondition, GameCopy, MAX_RESERVATION_DAYS, MAX_ACTIVE_RESERVATIONS_PER_MEMBER, hasActiveReservation } from "../entities/GameCopy";
import { GameQueueEntry } from "../entities/GameQueueEntry";
import { Game } from "../entities/Game";
import { Member } from "../entities/Member";
import { AuditAction, CopyAuditLog } from "../entities/CopyAuditLog";
import { dateString } from "../utils/date";
import { sendReservationEmail } from "../mailer";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const queueRepo = AppDataSource.getRepository(GameQueueEntry);
const copyRepo = AppDataSource.getRepository(GameCopy);
const gameRepo = AppDataSource.getRepository(Game);
const memberRepo = AppDataSource.getRepository(Member);
const auditRepo = AppDataSource.getRepository(CopyAuditLog);

const isFree = (copy: GameCopy): boolean =>
  copy.isAvailable && copy.condition !== CopyCondition.LOST && !hasActiveReservation(copy);

export const countMemberHolds = async (memberId: number): Promise<number> =>
  (await copyRepo.count({ where: { reservedFor: { id: memberId }, reservedUntil: MoreThanOrEqual(dateString()) } }))
  + (await queueRepo.count({ where: { member: { id: memberId } } }));

const processQueues = async (): Promise<void> => {
  const entries = await queueRepo.find({ relations: { game: true, member: true }, order: { id: "ASC" } });
  const byGame = new Map<number, GameQueueEntry[]>();
  for (const e of entries) byGame.set(e.game.id, [...(byGame.get(e.game.id) ?? []), e]);

  for (const [gameId, waiting] of byGame) {
    const copies = await copyRepo.find({ where: { game: { id: gameId } }, relations: { game: true, reservedFor: true } });

    for (const copy of copies.filter(isFree)) {
      let entry = waiting.shift();
      while (entry && !entry.member.isActive) {
        await queueRepo.remove(entry);
        entry = waiting.shift();
      }
      if (!entry) break;

      const until = dateString(MAX_RESERVATION_DAYS);
      copy.reservedFor = entry.member;
      copy.reservedUntil = until;
      await copyRepo.save(copy);
      await auditRepo.save(auditRepo.create({
        copy, copyNumberSnapshot: copy.copyNumber, gameId, action: AuditAction.RESERVED, oldValue: null,
        newValue: `${entry.member.firstName} ${entry.member.lastName} until ${until} (from waiting queue)`, performedBy: null,
      }));
      await queueRepo.remove(entry);
      sendReservationEmail(entry.member.email, entry.member.firstName, copy.game.title, copy.copyNumber, until)
        .catch(err => console.error("Failed to send reservation email:", err));
    }
  }
};

let chain: Promise<void> = Promise.resolve();
export const assignQueuedReservations = (): Promise<void> => {
  chain = chain.then(processQueues).catch(err => console.error("Failed to process waiting queues:", err));
  return chain;
};

export const getQueue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entries = await queueRepo.find({
      where: { game: { id: Number(req.params.id) }, member: { isActive: true } },
      relations: { member: true },
      order: { id: "ASC" },
    });
    res.json(entries);
  } catch (error) {
    console.error("Failed to load queue:", error);
    res.status(500).json({ message: "Failed to load the waiting queue" });
  }
};

export const joinQueue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    const memberId = Number(req.body.memberId);
    if (!memberId) return res.status(400).json({ message: "memberId is required" });

    const game = await gameRepo.findOneBy({ id: gameId });
    if (!game) return res.status(404).json({ message: "Game not found" });
    const member = await memberRepo.findOneBy({ id: memberId });
    if (!member) return res.status(404).json({ message: "Member not found" });
    if (!member.isActive) return res.status(409).json({ message: "Inactive members cannot join a queue" });

    const copies = await copyRepo.find({ where: { game: { id: gameId } }, relations: { reservedFor: true } });
    if (copies.some(isFree)) {
      return res.status(409).json({ message: "A copy is available right now, so there is no need to wait in a queue" });
    }
    if (await queueRepo.count({ where: { game: { id: gameId }, member: { id: memberId } } })) {
      return res.status(409).json({ message: "This member is already in the queue for this game" });
    }
    if (copies.some(c => hasActiveReservation(c) && c.reservedFor!.id === memberId)) {
      return res.status(409).json({ message: "This member already has a reserved copy of this game" });
    }
    if ((await countMemberHolds(memberId)) >= MAX_ACTIVE_RESERVATIONS_PER_MEMBER) {
      return res.status(409).json({ message: `${member.firstName} ${member.lastName} already has ${MAX_ACTIVE_RESERVATIONS_PER_MEMBER} active reservations / queue spots` });
    }

    const saved = await queueRepo.save(queueRepo.create({ game, member }));
    res.status(201).json(saved);
  } catch (error) {
    console.error("Failed to join queue:", error);
    res.status(500).json({ message: "Failed to join the waiting queue" });
  }
};

export const leaveQueue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = await queueRepo.findOne({ where: { id: Number(req.params.entryId), game: { id: Number(req.params.id) } } });
    if (!entry) return res.status(404).json({ message: "Queue entry not found" });
    await queueRepo.remove(entry);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to leave queue:", error);
    res.status(500).json({ message: "Failed to leave the waiting queue" });
  }
};
