import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import { sendResetCodeEmail, sendVerificationCodeEmail } from "../mailer";

const userRepository = AppDataSource.getRepository(User);

const JWT_SECRET = process.env.JWT_SECRET as string;
const verificationCodes = new Map<string, { code: string; expiresAt: Date }>();
const verificationCooldowns = new Map<string, number>();

export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const existingUser = await userRepository.findOneBy({ email });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const now = Date.now();
    const lastRequest = verificationCooldowns.get(email);
    if (lastRequest && (now - lastRequest) < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - lastRequest)) / 1000);
      return res.status(429).json({
        message: `Please wait ${waitSeconds} seconds before requesting another code`,
        retryAfterSeconds: waitSeconds,
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCooldowns.set(email, now);
    verificationCodes.set(email, {
      code,
      expiresAt: new Date(now + 10 * 60 * 1000)
    });

    await sendVerificationCodeEmail(email, code);

    res.json({ message: "A verification code has been sent to your email" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send verification code", error });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, verificationCode } = req.body;

    if (!email || !password || !verificationCode) {
      return res.status(400).json({ message: "email, password, and verificationCode are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existingUser = await userRepository.findOneBy({ email });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const stored = verificationCodes.get(email);
    if (!stored || stored.code !== verificationCode) {
      return res.status(400).json({ message: "Invalid verification code" });
    }
    if (stored.expiresAt < new Date()) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = userRepository.create({ email, passwordHash });
    await userRepository.save(user);

    verificationCodes.delete(email);
    verificationCooldowns.delete(email);

    res.status(201).json({ message: "Account created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to register", error });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await userRepository.findOneBy({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: "Your account is pending approval by an administrator." });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, 
        JWT_SECRET, { expiresIn: '1h' });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to login", error });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const user = await userRepository.findOneBy({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    if (user.resetCodeRequestedAt) {
      const secondsSinceLastRequest = (Date.now() - user.resetCodeRequestedAt.getTime()) / 1000;
      if (secondsSinceLastRequest < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceLastRequest);
        return res.status(429).json({
          message: `Please wait ${waitSeconds} seconds before requesting another code`,
          retryAfterSeconds: waitSeconds,
        });
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.resetCode = code;
    user.resetCodeExpiresAt = expiresAt;
    user.resetCodeRequestedAt = new Date();
    await userRepository.save(user);

    await sendResetCodeEmail(email, code);

    res.json({ message: "A reset code has been sent to your email" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send reset code", error });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "email, code, and newPassword are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await userRepository.findOneBy({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    if (!user.resetCode || user.resetCode !== code) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    if (!user.resetCodeExpiresAt || user.resetCodeExpiresAt < new Date()) {
      return res.status(400).json({ message: "Reset code has expired. Please request a new one." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetCode = null as any;
    user.resetCodeExpiresAt = null as any;
    await userRepository.save(user);

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset password", error });
  }
};