import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Game } from "../entities/Game";
import { GameCopy } from "../entities/GameCopy";
import { Member } from "../entities/Member";
import { Rental, RentalStatus } from "../entities/Rental";

const gameRepository = AppDataSource.getRepository(Game);
const gameCopyRepository = AppDataSource.getRepository(GameCopy);
const memberRepository = AppDataSource.getRepository(Member);
const rentalRepository = AppDataSource.getRepository(Rental);

export const getStats = async (req: Request, res: Response) => {
  try {
    const totalGames = await gameRepository.count();
    const totalCopies = await gameCopyRepository.count();
    const activeMembers = await memberRepository.count({ where: { isActive: true } });
    const inactiveMembers = await memberRepository.count({ where: { isActive: false } });
    const activeRentals = await rentalRepository.count({ where: { status: RentalStatus.ACTIVE } });

    const today = new Date().toISOString().split("T")[0];
    const overdueRentals = await rentalRepository
      .createQueryBuilder("rental")
      .where("rental.status = :status", { status: RentalStatus.ACTIVE })
      .andWhere("rental.dueDate < :today", { today })
      .getCount();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    const topGamesThisMonth = await rentalRepository
      .createQueryBuilder("rental")
      .leftJoin("rental.gameCopy", "gameCopy")
      .leftJoin("gameCopy.game", "game")
      .select("game.title", "title")
      .addSelect("COUNT(rental.id)", "rentalCount")
      .where("rental.rentalDate >= :startOfMonth", { startOfMonth: startOfMonthStr })
      .andWhere("game.id IS NOT NULL")
      .groupBy("game.id")
      .orderBy("rentalCount", "DESC")
      .limit(5)
      .getRawMany();

    const allGames = await gameRepository.find({
      relations: { copies: { rentals: true } },
    });

    const unusedGames = allGames
      .map((game) => {
        const allRentalDates = (game.copies || [])
          .flatMap((copy) => copy.rentals || [])
          .map((rental) => rental.rentalDate)
          .sort()
          .reverse();

        const lastRentedDate = allRentalDates.length > 0 ? allRentalDates[0] : null;

        return {
          title: game.title,
          imageUrl: game.imageUrl,
          lastRentedDate,
          createdAt: game.createdAt,
        };
      })
      .sort((a, b) => {
        if (!a.lastRentedDate && !b.lastRentedDate) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (!a.lastRentedDate) return -1;
        if (!b.lastRentedDate) return 1;
        return a.lastRentedDate.localeCompare(b.lastRentedDate);
      })
      .slice(0, 5);

    res.json({
      totalGames,
      totalCopies,
      activeMembers,
      inactiveMembers,
      activeRentals,
      overdueRentals,
      topGamesThisMonth,
      unusedGames,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats", error });
  }
};