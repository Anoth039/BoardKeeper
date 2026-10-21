import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import { Permission, Role, hasPermission } from "../permissions";

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: Role;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });

    if (!user || !user.isApproved) {
      return res.status(401).json({ message: "Account is not active" });
    }

    req.user = { userId: user.id, email: user.email, role: user.role };
  } catch (error) {
    console.error("Failed to load authenticated user:", error);
    return res.status(500).json({ message: "Failed to authenticate" });
  }

  next();
};

export const requirePermission = (permission: Permission) => (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({ message: `Missing permission: ${permission}` });
  }

  next();
};
