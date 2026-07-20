import 'reflect-metadata';
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './data-source';
import gameRoutes from './routes/gameRoutes';
import rentalRoutes from './routes/rentalRoutes';
import memberRoutes from './routes/memberRoutes';
import gameCopyRoutes from './routes/gameCopyRoutes';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/games", gameRoutes);
app.use("/api/game-copies", gameCopyRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/rentals", rentalRoutes);

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