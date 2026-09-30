import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Game } from "./Game";
import { Rental } from "./Rental";
import { Member } from "./Member";
import { dateString } from "../utils/date";

export enum CopyCondition {
  NEW = "new",
  GOOD = "good",
  WORN = "worn",
  DAMAGED = "damaged",
  LOST = "lost"
}

@Entity()
export class GameCopy {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, (game) => game.copies, { onDelete: "CASCADE" })
  @JoinColumn({ name: "game_id" })
  game!: Game;

  @Column({
    type: "enum",
    enum: CopyCondition,
    default: CopyCondition.GOOD,
  })
  condition!: CopyCondition;

  @Column({ name: "copy_number" })
  copyNumber!: string;

  @Column({ name: "is_available", default: true })
  isAvailable!: boolean;

  @ManyToOne(() => Member, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "reserved_for_member_id" })
  reservedFor!: Member | null;

  @Column({ name: "reserved_until", type: "date", nullable: true })
  reservedUntil!: string | null;

  @OneToMany(() => Rental, (rental) => rental.gameCopy)
  rentals!: Rental[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ type: "text", nullable: true, name: "notes" })
  notes!: string | null;
}

export const MAX_RESERVATION_DAYS = 2;
export const MAX_ACTIVE_RESERVATIONS_PER_MEMBER = 2;
export const MAX_ACTIVE_RENTALS_PER_MEMBER = 3;

export const hasActiveReservation = (copy: Pick<GameCopy, "reservedFor" | "reservedUntil">): boolean =>
  !!copy.reservedFor && !!copy.reservedUntil && copy.reservedUntil >= dateString();
