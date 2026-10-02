import { hasActiveReservation } from "../entities/GameCopy";
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Game } from "../entities/Game";
import { ILike } from "typeorm";

const gameRepository = AppDataSource.getRepository(Game);

export const getAllGames = async (req: Request, res: Response) => {
  try {
    const games = await gameRepository.find({ relations: { copies: { reservedFor: true } } });
    res.json(games);
  } catch (error) {
    console.error("Failed to fetch games:", error);
    res.status(500).json({ message: "Failed to fetch games" });
  }
};

export const getGameById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const game = await gameRepository.findOne({
      where: { id },
      relations: { copies: { reservedFor: true } },
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json(game);
  } catch (error) {
    console.error("Failed to fetch game:", error);
    res.status(500).json({ message: "Failed to fetch game" });
  }
};

export const createGame = async (req: Request, res: Response) => {
  try {
    const { title, description, minPlayers, maxPlayers, category, imageUrl, ageRating, estimatedTimeMinutes, pricePerDay, replacementValue } = req.body;

    if (!title || !minPlayers || !maxPlayers) {
      return res.status(400).json({ message: "title, minPlayers, and maxPlayers are required" });
    }
    if (!(Number(pricePerDay) > 0) || !(Number(replacementValue) > 0)) {
      return res.status(400).json({ message: "pricePerDay and replacementValue must be greater than 0" });
    }

    const existing = await gameRepository.findOne({
      where: { title: ILike(title.trim()) }
    });

    if (existing) {
      return res.status(409).json({ message: `A game named "${existing.title}" already exists` });
    }

    if (category) {
      const items = category.split(',').map((s: string) => s.trim().toLowerCase().replace(/\s+/g, '')).filter(Boolean);

      if (new Set(items).size !== items.length) {
        return res.status(400).json({ message: "Duplicate categories are not allowed" });
      }
    }

    const game = gameRepository.create({
      title: title.trim(),
      description,
      minPlayers,
      maxPlayers,
      category,
      imageUrl,
      ageRating,
      estimatedTimeMinutes,
      pricePerDay,
      replacementValue,
    });

    const savedGame = await gameRepository.save(game);
    res.status(201).json(savedGame);
  } catch (error) {
    console.error("Failed to create game:", error);
    res.status(500).json({ message: "Failed to create game" });
  }
};

export const updateGame = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const game = await gameRepository.findOneBy({ id });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const { pricePerDay, replacementValue } = req.body;
    if ((pricePerDay !== undefined && !(Number(pricePerDay) > 0)) || (replacementValue !== undefined && !(Number(replacementValue) > 0))) {
      return res.status(400).json({ message: "pricePerDay and replacementValue must be greater than 0" });
    }

    if (req.body.title && req.body.title.trim() !== game.title) {
      const existing = await gameRepository.findOne({
        where: { title: ILike(req.body.title.trim()) }
      });
      if (existing) {
        return res.status(409).json({ message: `A game named "${existing.title}" already exists` });
      }
      req.body.title = req.body.title.trim();
    }

    if (req.body.category) {
      const items = req.body.category.split(',').map((s: string) => s.trim().toLowerCase().replace(/\s+/g, '')).filter(Boolean);

      if (new Set(items).size !== items.length) {
        return res.status(400).json({ message: "Duplicate categories are not allowed" });
      }
    }

    gameRepository.merge(game, req.body);
    const updatedGame = await gameRepository.save(game);
    res.json(updatedGame);
  } catch (error) {
    console.error("Failed to update game:", error);
    res.status(500).json({ message: "Failed to update game" });
  }
};

export const deleteGame = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const game = await gameRepository.findOne({
      where: { id },
      relations: { copies: { rentals: true, reservedFor: true } },
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const hasActiveRentals = game.copies?.some(copy =>
      copy.rentals?.some(rental => rental.status === "active")
    );

    if (hasActiveRentals) {
      return res.status(409).json({
        message: "Cannot delete this game — one or more copies are currently rented out. Please wait until they are returned.",
      });
    }

    if (game.copies?.some(hasActiveReservation)) {
      return res.status(409).json({
        message: "Cannot delete this game — one or more copies are reserved. Please cancel the reservations first.",
      });
    }

    await gameRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete game:", error);
    res.status(500).json({ message: "Failed to delete game" });
  }
};