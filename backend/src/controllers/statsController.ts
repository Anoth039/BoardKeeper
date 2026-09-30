import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Game } from "../entities/Game";
import { GameCopy } from "../entities/GameCopy";
import { Member } from "../entities/Member";
import { Rental, RentalStatus } from "../entities/Rental";
import { dateString, daysBetween, monthStartString, toDateString } from "../utils/date";

const gameRepo = AppDataSource.getRepository(Game);
const copyRepo = AppDataSource.getRepository(GameCopy);
const memberRepo = AppDataSource.getRepository(Member);
const rentalRepo = AppDataSource.getRepository(Rental);

export const getStats = async (req: Request, res: Response) => {
  try {
    const today = dateString();
    const monthStart = monthStartString();
    const fourteenDaysAgo = dateString(-13);

    const totalGames = await gameRepo.count();
    const totalCopies = await copyRepo.count();
    const availableCopies = await copyRepo
      .createQueryBuilder("c")
      .where("c.is_available = true")
      .andWhere("c.condition != :lost", { lost: "lost" })
      .andWhere("(c.reserved_for_member_id IS NULL OR c.reserved_until < :today)", { today })
      .getCount();
    const activeMembers = await memberRepo.count({ where: { isActive: true } });

    const activeRentals = await rentalRepo
      .createQueryBuilder("r")
      .where("r.status = :s", { s: RentalStatus.ACTIVE })
      .getCount();

    const activeReservations = await copyRepo
      .createQueryBuilder("c")
      .where("c.reserved_for_member_id IS NOT NULL")
      .andWhere("c.reserved_until >= :today", { today })
      .getCount();

    const overdueRentals = await rentalRepo
      .createQueryBuilder("r")
      .where("r.status = :s", { s: RentalStatus.ACTIVE })
      .andWhere("r.due_date < :today", { today })
      .getCount();

    const monthActive = await rentalRepo
      .createQueryBuilder("r")
      .where("r.status = :s", { s: RentalStatus.ACTIVE })
      .andWhere("DATE(r.rental_date) >= :start", { start: monthStart })
      .getCount();

    const monthOverdue = await rentalRepo
      .createQueryBuilder("r")
      .where("r.status = :s", { s: RentalStatus.ACTIVE })
      .andWhere("r.due_date < :today", { today })
      .andWhere("DATE(r.rental_date) >= :start", { start: monthStart })
      .getCount();

    const monthReturned = await rentalRepo
      .createQueryBuilder("r")
      .where("r.status = :s", { s: RentalStatus.RETURNED })
      .andWhere("DATE(r.rental_date) >= :start", { start: monthStart })
      .getCount();

    const monthLost = await rentalRepo
      .createQueryBuilder("r")
      .where("r.status = :s", { s: RentalStatus.LOST })
      .andWhere("DATE(r.rental_date) >= :start", { start: monthStart })
      .getCount();

    const topGamesThisMonth = await rentalRepo
      .createQueryBuilder("r")
      .leftJoin("r.gameCopy", "copy")
      .leftJoin("copy.game", "game")
      .select("game.title", "title")
      .addSelect("COUNT(r.id)", "rentalCount")
      .where("DATE(r.rental_date) >= :start", { start: monthStart })
      .andWhere("game.id IS NOT NULL")
      .groupBy("game.id")
      .addGroupBy("game.title")
      .orderBy("rentalCount", "DESC")
      .limit(5)
      .getRawMany();

    const rawActivity = await rentalRepo
      .createQueryBuilder("r")
      .select("DATE(r.rental_date)", "date")
      .addSelect("COUNT(r.id)", "count")
      .where("DATE(r.rental_date) >= :start", { start: fourteenDaysAgo })
      .groupBy("DATE(r.rental_date)")
      .orderBy("date", "ASC")
      .getRawMany();

    const activityMap = new Map<string, number>(
      rawActivity.map((row) => [toDateString(row.date), Number(row.count)])
    );

    const rentalActivity: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const ds = dateString(-i);
      rentalActivity.push({ date: ds, count: activityMap.get(ds) ?? 0 });
    }

    const allGames = await gameRepo.find({
      relations: { copies: { rentals: true } },
    });

    const twoWeeksAgo = dateString(-14);

    const unusedGames = allGames
      .map((g) => {
        const dates = (g.copies ?? [])
          .flatMap((c) => c.rentals ?? [])
          .map((r) => r.rentalDate)
          .sort()
          .reverse();
        return {
          title: g.title,
          imageUrl: g.imageUrl ?? null,
          lastRentedDate: dates[0] ?? null,
          createdAt: g.createdAt,
        };
      })
      .filter((g) => {
        if (!g.lastRentedDate) {
          return daysBetween(g.createdAt) > 7;
        }

        return g.lastRentedDate < twoWeeksAgo;
      })
      .sort((a, b) => {
        if (!a.lastRentedDate && !b.lastRentedDate) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (!a.lastRentedDate) return -1;
        if (!b.lastRentedDate) return 1;
        return a.lastRentedDate.localeCompare(b.lastRentedDate);
      })
      .slice(0, 10);

    res.json({
      summary: {
        totalGames,
        totalCopies,
        availableCopies,
        activeMembers,
        activeRentals,
        activeReservations,
        overdueRentals,
      },
      monthlyBreakdown: {
        active: monthActive - monthOverdue,
        overdue: monthOverdue,
        returned: monthReturned,
        lost: monthLost,
      },
      topGamesThisMonth,
      rentalActivity,
      unusedGames,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};