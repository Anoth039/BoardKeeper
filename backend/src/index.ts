import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from './data-source';
import app from './app';
import { assignQueuedReservations } from './controllers/queueController';
import { deactivateInactiveMembers } from './controllers/memberController';

const PORT = process.env.PORT || 3000;

AppDataSource.initialize()
  .then(() => {
    console.log('Adatbázis kapcsolat sikeres.');
    app.listen(PORT, () => {
      console.log(`Szerver fut: http://localhost:${PORT}`);
      assignQueuedReservations();
      setInterval(assignQueuedReservations, 60 * 60 * 1000);
      deactivateInactiveMembers();
      setInterval(deactivateInactiveMembers, 24 * 60 * 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('Adatbázis kapcsolat sikertelen:', err);
  });
