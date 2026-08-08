import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { GameCopy } from "../entities/GameCopy";
import { Game } from "../entities/Game";

const gameCopyRepository = AppDataSource.getRepository(GameCopy);
const gameRepository = AppDataSource.getRepository(Game);

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
export const createGameCopy = async (req: Request, res: Response) => {
  try {
    const { gameId, condition, copyNumber } = req.body;

    if (!gameId) {
      return res.status(400).json({ message: "gameId is required" });
    }

    if (!copyNumber || copyNumber.trim().length < 3 || copyNumber.trim().length > 12) {
      return res.status(400).json({ message: "copyNumber must be between 3 and 12 characters" });
    }

    const game = await gameRepository.findOneBy({ id: gameId });
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const existingCopy = await gameCopyRepository
      .createQueryBuilder("copy")
      .where("copy.game.id = :gameId", { gameId })
      .andWhere("LOWER(copy.copyNumber) = LOWER(:copyNumber)", { copyNumber: copyNumber.trim() })
      .getOne();

    if (existingCopy) {
      return res.status(409).json({ message: "A copy with this name already exists for this game" });
    }

    const copy = gameCopyRepository.create({
      game,
      condition,
      copyNumber: copyNumber.trim(),
    });

    const savedCopy = await gameCopyRepository.save(copy);
    res.status(201).json(savedCopy);
  } catch (error) {
    res.status(500).json({ message: "Failed to create game copy", error });
  }
};

// PUT /api/game-copies/:id
export const updateGameCopy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { game: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "Game copy not found" });
    }

    const { copyNumber } = req.body;

    if (!copyNumber || copyNumber.trim().length < 3 || copyNumber.trim().length > 12) {
      return res.status(400).json({ message: "copyNumber must be between 3 and 12 characters" });
    }

    const existingCopy = await gameCopyRepository
      .createQueryBuilder("copy")
      .where("copy.game.id = :gameId", { gameId: copy.game.id })
      .andWhere("LOWER(copy.copyNumber) = LOWER(:copyNumber)", { copyNumber: copyNumber.trim() })
      .andWhere("copy.id != :id", { id })
      .getOne();

    if (existingCopy) {
      return res.status(409).json({ message: "A copy with this name already exists for this game" });
    }

    req.body.copyNumber = copyNumber.trim();
    gameCopyRepository.merge(copy, req.body);
    const updatedCopy = await gameCopyRepository.save(copy);
    res.json(updatedCopy);
  } catch (error) {
    res.status(500).json({ message: "Failed to update game copy", error });
  }
};

// DELETE /api/game-copies/:id
export const deleteGameCopy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const copy = await gameCopyRepository.findOne({
      where: { id },
      relations: { rentals: true },
    });

    if (!copy) {
      return res.status(404).json({ message: "Game copy not found" });
    }

    const hasActiveRental = copy.rentals?.some(rental => rental.status === "active");

    if (hasActiveRental) {
      return res.status(409).json({
        message: "Cannot delete this copy — it is currently rented out.",
      });
    }

    await gameCopyRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete game copy", error });
  }
};