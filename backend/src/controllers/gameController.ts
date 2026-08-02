import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Game } from "../entities/Game";

const gameRepository = AppDataSource.getRepository(Game);

// GET /api/games
export const getAllGames = async (req: Request, res: Response) => {
  try {
    const games = await gameRepository.find({ relations: { copies: true } });
    res.json(games);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch games", error });
  }
};

// GET /api/games/:id
export const getGameById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const game = await gameRepository.findOne({
      where: { id },
      relations: { copies: true },
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json(game);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch game", error });
  }
};

// POST /api/games
export const createGame = async (req: Request, res: Response) => {
  try {
    const { title, description, minPlayers, maxPlayers, category, imageUrl, ageRating, estimatedTimeMinutes } = req.body;

    if (!title || !minPlayers || !maxPlayers) {
      return res.status(400).json({ message: "title, minPlayers, and maxPlayers are required" });
    }

    const game = gameRepository.create({
      title,
      description,
      minPlayers,
      maxPlayers,
      category,
      imageUrl,
      ageRating,
      estimatedTimeMinutes,
    });

    const savedGame = await gameRepository.save(game);
    res.status(201).json(savedGame);
  } catch (error) {
    res.status(500).json({ message: "Failed to create game", error });
  }
};

// PUT /api/games/:id
export const updateGame = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const game = await gameRepository.findOneBy({ id });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    gameRepository.merge(game, req.body);
    const updatedGame = await gameRepository.save(game);
    res.json(updatedGame);
  } catch (error) {
    res.status(500).json({ message: "Failed to update game", error });
  }
};

// DELETE /api/games/:id
export const deleteGame = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const game = await gameRepository.findOne({
      where: { id },
      relations: { copies: { rentals: true } },
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

    await gameRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete game", error });
  }
};