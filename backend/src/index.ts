import 'reflect-metadata';
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './data-source';
import gameRoutes from './routes/gameRoutes';
import rentalRoutes from './routes/rentalRoutes';
import memberRoutes from './routes/memberRoutes';
import gameCopyRoutes from './routes/gameCopyRoutes';
import authRoutes from './routes/authRoutes';
import { requireAuth } from './middleware/authMiddleware';
import statsRoutes from './routes/statsRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/games", requireAuth, gameRoutes);
app.use("/api/game-copies", requireAuth, gameCopyRoutes);
app.use("/api/members", requireAuth, memberRoutes);
app.use("/api/rentals", requireAuth, rentalRoutes);
app.use("/api/stats", requireAuth, statsRoutes);
app.use("/api/users", requireAuth, userRoutes);

AppDataSource.initialize()
  .then(() => {
    console.log('Adatbázis kapcsolat sikeres.');
    app.listen(PORT, () => {
      console.log(`Szerver fut: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Adatbázis kapcsolat sikertelen:', err);
  });