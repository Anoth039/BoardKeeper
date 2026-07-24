import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Member } from "../entities/Member";
import { Rental, RentalStatus } from "../entities/Rental";

const memberRepository = AppDataSource.getRepository(Member);
const rentalRepository = AppDataSource.getRepository(Rental);

// GET /api/members
export const getAllMembers = async (req: Request, res: Response) => {
  try {
    const members = await memberRepository.find();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch members", error });
  }
};

// GET /api/members/:id
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
    res.status(500).json({ message: "Failed to fetch member", error });
  }
};

// POST /api/members
export const createMember = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "firstName, lastName, and email are required" });
    }

    const member = memberRepository.create({ firstName, lastName, email, phone });
    const savedMember = await memberRepository.save(member);
    res.status(201).json(savedMember);
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "A member with this email already exists" });
    }
    res.status(500).json({ message: "Failed to create member", error });
  }
};

// PUT /api/members/:id
export const updateMember = async (req: Request, res: Response) => {
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

    memberRepository.merge(member, req.body);
    const updatedMember = await memberRepository.save(member);
    res.json(updatedMember);
  } catch (error) {
    res.status(500).json({ message: "Failed to update member", error });
  }
};

// DELETE /api/members/:id
export const deleteMember = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await memberRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete member", error });
  }
};