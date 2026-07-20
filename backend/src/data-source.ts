import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { GameCopy } from './entities/GameCopy';
import { Game } from './entities/Game';
import { Rental } from './entities/Rental';
import { Member } from './entities/Member';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'boardkeeper_db',
  synchronize: true,
  logging: true,
  entities: [Game, GameCopy, Member, Rental],
});