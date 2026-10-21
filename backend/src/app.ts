import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/gameRoutes';
import rentalRoutes from './routes/rentalRoutes';
import memberRoutes from './routes/memberRoutes';
import gameCopyRoutes from './routes/gameCopyRoutes';
import authRoutes from './routes/authRoutes';
import statsRoutes from './routes/statsRoutes';
import userRoutes from './routes/userRoutes';
import { requireAuth } from './middleware/authMiddleware';

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/games", requireAuth, gameRoutes);
app.use("/api/game-copies", requireAuth, gameCopyRoutes);
app.use("/api/members", requireAuth, memberRoutes);
app.use("/api/rentals", requireAuth, rentalRoutes);
app.use("/api/stats", requireAuth, statsRoutes);
app.use("/api/users", requireAuth, userRoutes);

export default app;
