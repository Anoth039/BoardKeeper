import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";

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
    res.status(500).json({ message: "Failed to fetch users", error });
  }
};

export const toggleUserApproval = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await userRepository.findOneBy({ id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be modified this way" });
    }

    user.isApproved = !user.isApproved;
    await userRepository.save(user);

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await userRepository.findOneBy({ id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be deleted this way" });
    }

    await userRepository.delete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error });
  }
};