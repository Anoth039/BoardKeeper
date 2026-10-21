import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/entities/User';
import { Game } from '../src/entities/Game';
import { GameCopy, CopyCondition } from '../src/entities/GameCopy';
import { Member } from '../src/entities/Member';
import { Rental, RentalStatus } from '../src/entities/Rental';
import { dateString } from '../src/utils/date';
import { Role } from '../src/permissions';

let counter = 0;
export const uid = () => `${Date.now()}_${++counter}`;

export const initDb = async () => {
  if (!process.env.DB_NAME?.endsWith('_test')) {
    throw new Error(`A tesztadatbázis neve "_test"-re kell, hogy végződjön (most: ${process.env.DB_NAME}).`);
  }
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
};

export const closeDb = async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
};

export const resetDb = async () => {
  const qr = AppDataSource.createQueryRunner();
  try {
    await qr.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const meta of AppDataSource.entityMetadatas) {
      await qr.query(`TRUNCATE TABLE \`${meta.tableName}\``);
    }
    await qr.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await qr.release();
  }
};

export const tokenFor = (user: { id: number; email: string; role: string }) =>
  jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

export const bearer = (user: User) => `Bearer ${tokenFor(user)}`;

export const createUser = async (overrides: Partial<User> & { password?: string } = {}): Promise<User> => {
  const { password = 'Password123', ...rest } = overrides;
  const repo = AppDataSource.getRepository(User);
  return repo.save(repo.create({
    email: `user_${uid()}@test.hu`,
    passwordHash: await bcrypt.hash(password, 4),
    role: Role.STAFF,
    isApproved: true,
    ...rest,
  }));
};

export const createStaff = () => createUser({ role: Role.STAFF });
export const createAdmin = () => createUser({ role: Role.ADMIN });

export const createGame = async (overrides: Partial<Game> = {}): Promise<Game> => {
  const repo = AppDataSource.getRepository(Game);
  return repo.save(repo.create({
    title: `Játék ${uid()}`,
    minPlayers: 2,
    maxPlayers: 4,
    pricePerDay: 2,
    replacementValue: 40,
    ...overrides,
  }));
};

export const createCopy = async (game: Game, overrides: Partial<GameCopy> = {}): Promise<GameCopy> => {
  const repo = AppDataSource.getRepository(GameCopy);
  return repo.save(repo.create({
    game,
    copyNumber: `C-${uid()}`.slice(0, 12),
    condition: CopyCondition.GOOD,
    isAvailable: true,
    ...overrides,
  }));
};

export const createMember = async (overrides: Partial<Member> = {}): Promise<Member> => {
  const repo = AppDataSource.getRepository(Member);
  return repo.save(repo.create({
    firstName: 'Teszt',
    lastName: 'Elek',
    email: `member_${uid()}@test.hu`,
    isActive: true,
    ...overrides,
  }));
};

export const createRentalDirect = async (
  member: Member,
  copy: GameCopy,
  opts: { rentalOffset?: number; dueOffset?: number; status?: RentalStatus; rate?: number } = {},
): Promise<Rental> => {
  const { rentalOffset = 0, dueOffset = 3, status = RentalStatus.ACTIVE, rate = 2 } = opts;
  const repo = AppDataSource.getRepository(Rental);
  const rental = await repo.save(repo.create({
    member,
    gameCopy: copy,
    rentalDate: dateString(rentalOffset),
    dueDate: dateString(dueOffset),
    originalDueDate: dateString(dueOffset),
    status,
    gameTitleSnapshot: copy.game?.title,
    copyLabelSnapshot: copy.copyNumber,
    pricePerDaySnapshot: rate,
  }));
  if (status === RentalStatus.ACTIVE) {
    await AppDataSource.getRepository(GameCopy).update(copy.id, { isAvailable: false });
  }
  return rental;
};
