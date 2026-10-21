import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import { Role, isRole } from "../permissions";
import { sendApprovalEmail } from "../mailer";

const userRepository = AppDataSource.getRepository(User);

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userRepository.find({
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
        createdAt: true,
        lastLoginAt: true,
      },
      order: { createdAt: "DESC" },
    });
    res.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const toggleUserApproval = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await userRepository.findOneBy({ id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === Role.ADMIN) {
      return res.status(400).json({ message: "Admin accounts cannot be modified this way" });
    }

    const requestedRole = req.body?.role;
    if (requestedRole !== undefined && !isRole(requestedRole)) {
      return res.status(400).json({ message: "role must be 'staff' or 'admin'" });
    }

    user.isApproved = !user.isApproved;
    if (user.isApproved && requestedRole !== undefined) {
      user.role = requestedRole;
    }
    await userRepository.save(user);

    if (user.isApproved) {
      try {
        await sendApprovalEmail(user.email, user.role);
      } catch (mailError) {
        console.error("Failed to send approval email:", mailError);
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await userRepository.findOneBy({ id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === Role.ADMIN) {
      return res.status(400).json({ message: "Admin accounts cannot be deleted this way" });
    }

    await userRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};