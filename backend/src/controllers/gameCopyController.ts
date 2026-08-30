import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { GameCopy } from "../entities/GameCopy";
import { Game } from "../entities/Game";
import { AuditAction, CopyAuditLog } from "../entities/CopyAuditLog";
import { User } from "../entities/User";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const gameCopyRepository = AppDataSource.getRepository(GameCopy);
const gameRepository = AppDataSource.getRepository(Game);

const auditRepo = AppDataSource.getRepository(CopyAuditLog);
const userRepo = AppDataSource.getRepository(User);

async function logAudit(copy: GameCopy, gameId: number, action: AuditAction, oldValue: string | null, newValue: string | null, userId: number | null): Promise<void> {
  const performedBy = userId ? await userRepo.findOneBy({ id: userId }) : null;
  const log = auditRepo.create({ copy, copyNumberSnapshot: copy.copyNumber, gameId, action, oldValue, newValue, performedBy });
  await auditRepo.save(log);
}

// GET /api/game-copies
export const getAllGameCopies = async (req: Request, res: Response) => {
  try {
    const copies = await gameCopyRepository.find({ relations: { game: true } });
    res.json(copies);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch game copies", error });
  }
};

// GET /api/game-copies/:id
export const getGameCopyById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { game: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "Game copy not found" });
    }

    res.json(copy);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch game copy", error });
  }
};

// POST /api/game-copies
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

    const existing = await gameCopyRepository
      .createQueryBuilder("copy")
      .where("copy.game.id = :gameId", { gameId })
      .andWhere("LOWER(copy.copyNumber) = LOWER(:copyNumber)", { copyNumber: trimmed })
      .getOne();

    if (existing) {
      return res.status(409).json({ message: `A copy named "${trimmed}" already exists for this game` });
    }

    const copy = gameCopyRepository.create({
      game,
      copyNumber: trimmed,
      condition: condition || "good",
      isAvailable: true,
    });

    const saved = await gameCopyRepository.save(copy);

    await logAudit(saved, game.id, AuditAction.CREATED, null, `Condition: ${saved.condition}`, req.user?.userId ?? null);

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: "Failed to create copy", error });
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

      const existing = await gameCopyRepository
        .createQueryBuilder("copy")
        .where("copy.game.id = :gameId", { gameId })
        .andWhere("LOWER(copy.copyNumber) = LOWER(:copyNumber)", { copyNumber })
        .getOne();

      if (existing) duplicates.push(copyNumber);
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

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: "Failed to create copies", error });
  }
};

// PUT /api/game-copies/:id
export const updateGameCopy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { game: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "GameCopy not found" });
    }

    const { copyNumber, condition, notes } = req.body;
    const userId = req.user?.userId ?? null;
    const gameId = copy.game.id;

    if (copyNumber !== undefined && copyNumber.trim() !== copy.copyNumber) {
      const trimmed = copyNumber.trim();
      if (trimmed.length < 3 || trimmed.length > 12) {
        return res.status(400).json({ message: "copyNumber must be between 3 and 12 characters" });
      }
      await logAudit(copy, gameId, AuditAction.NAME_CHANGED, copy.copyNumber, trimmed, userId);
      copy.copyNumber = trimmed;
    }

    if (condition !== undefined && condition !== copy.condition) {
      await logAudit(copy, gameId, AuditAction.CONDITION_CHANGED, copy.condition, condition, userId);
      copy.condition = condition;
      if (condition === "lost") {
        copy.isAvailable = false;
      } else if (copy.condition !== "lost") {
        copy.isAvailable = true;
      }
    }

    if (notes !== undefined && notes !== copy.notes) {
      await logAudit(copy, gameId, AuditAction.NOTES_CHANGED, copy.notes || null, notes || null, userId);
      copy.notes = notes;
    }

    const updated = await gameCopyRepository.save(copy);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update copy", error });
  }
};

// DELETE /api/game-copies/:id
export const deleteGameCopy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { rentals: true, game: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "GameCopy not found" });
    }

    const hasActiveRentals = copy.rentals?.some(r => r.status === "active");
    if (hasActiveRentals) {
      return res.status(409).json({ message: "Cannot delete a copy that is currently rented out" });
    }

    await logAudit(copy, copy.game.id, AuditAction.DELETED, copy.condition, null, req.user?.userId ?? null);

    await gameCopyRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete copy", error });
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
    res.status(500).json({ message: "Failed to fetch audit log", error });
  }
};