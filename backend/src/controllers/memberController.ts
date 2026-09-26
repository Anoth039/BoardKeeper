import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Member } from "../entities/Member";
import { Rental, RentalStatus } from "../entities/Rental";
import { GameCopy } from "../entities/GameCopy";
import { MoreThanOrEqual } from "typeorm";
import { dateString } from "../utils/date";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const memberRepository = AppDataSource.getRepository(Member);
const rentalRepository = AppDataSource.getRepository(Rental);
const gameCopyRepository = AppDataSource.getRepository(GameCopy);

const countActiveReservations = (memberId: number) => gameCopyRepository.count({ where: { reservedFor: { id: memberId }, reservedUntil: MoreThanOrEqual(dateString()) } });

export const getAllMembers = async (req: Request, res: Response) => {
  try {
    const members = await memberRepository.find({
      relations: { rentals: true },
    });
    res.json(members);
  } catch (error) {
    console.error("Failed to fetch members:", error);
    res.status(500).json({ message: "Failed to fetch members" });
  }
};

export const getMemberById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const member = await memberRepository.findOne({
      where: { id },
      relations: { rentals: { gameCopy: { game: true } } },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    res.json(member);
  } catch (error) {
    console.error("Failed to fetch member:", error);
    res.status(500).json({ message: "Failed to fetch member" });
  }
};

export const createMember = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "firstName, lastName, and email are required" });
    }

    if (firstName.trim().length > 30) {
      return res.status(400).json({ message: "First name cannot exceed 30 characters" });
    }
    if (lastName.trim().length > 30) {
      return res.status(400).json({ message: "Last name cannot exceed 30 characters" });
    }
    if (email.trim().length > 50) {
      return res.status(400).json({ message: "Email cannot exceed 50 characters" });
    }
    if (phone && !/^\+?[\d\s\-().]{6,20}$/.test(phone.trim())) {
      return res.status(400).json({ message: "Phone number format is invalid" });
    }

    const member = memberRepository.create({ firstName, lastName, email, phone });
    const savedMember = await memberRepository.save(member);
    res.status(201).json(savedMember);
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "A member with this email already exists" });
    }
    console.error("Failed to create member:", error);
    res.status(500).json({ message: "Failed to create member" });
  }
};

export const updateMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const member = await memberRepository.findOneBy({ id });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (req.body.isActive === false && member.isActive === true) {
      const activeRentalCount = await rentalRepository.count({
        where: { member: { id }, status: RentalStatus.ACTIVE },
      });

      if (activeRentalCount > 0) {
        return res.status(409).json({
          message: `Cannot deactivate this member — they have ${activeRentalCount} active rental(s). Please return them first.`,
        });
      }
    }

    if (req.body.isActive === false && member.isActive === true) {
      const reservations = await countActiveReservations(id);
      if (reservations > 0) {
        return res.status(409).json({
          message: `Cannot deactivate this member — they have ${reservations} reserved copy/copies. Please cancel the reservation(s) first.`,
        });
      }
    }

    const { firstName, lastName, email, phone } = req.body;

    if (firstName && firstName.trim().length > 30) {
      return res.status(400).json({ message: "First name cannot exceed 30 characters" });
    }
    if (lastName && lastName.trim().length > 30) {
      return res.status(400).json({ message: "Last name cannot exceed 30 characters" });
    }
    if (email && email.trim().length > 50) {
      return res.status(400).json({ message: "Email cannot exceed 50 characters" });
    }
    if (phone && !/^\+?[\d\s\-().]{6,20}$/.test(phone.trim())) {
      return res.status(400).json({ message: "Phone number format is invalid" });
    }

    const updates: Partial<Member> = {};
    for (const field of ["firstName", "lastName", "email", "phone", "isActive"] as const) {
      if (req.body[field] !== undefined) {
        (updates as Record<string, unknown>)[field] = req.body[field];
      }
    }
    memberRepository.merge(member, updates);
    const updatedMember = await memberRepository.save(member);
    res.json(updatedMember);
  } catch (error) {
    console.error("Failed to update member:", error);
    res.status(500).json({ message: "Failed to update member" });
  }
};

export const deleteMember = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const member = await memberRepository.findOne({
      where: { id },
      relations: { rentals: true },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.rentals && member.rentals.length > 0) {
      return res.status(409).json({
        message: "Cannot delete a member with rental history. Deactivate instead.",
      });
    }

    if ((await countActiveReservations(id)) > 0) {
      return res.status(409).json({ message: "Cannot delete a member who has reserved copies. Please cancel the reservation(s) first." });
    }

    await memberRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete member:", error);
    res.status(500).json({ message: "Failed to delete member" });
  }
};