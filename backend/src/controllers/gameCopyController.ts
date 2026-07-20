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

    const game = await gameRepository.findOneBy({ id: gameId });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const copy = gameCopyRepository.create({
      game,
      condition,
      copyNumber,
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
    const copy = await gameCopyRepository.findOneBy({ id });

    if (!copy) {
      return res.status(404).json({ message: "Game copy not found" });
    }

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
    const result = await gameCopyRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ message: "Game copy not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete game copy", error });
  }
};