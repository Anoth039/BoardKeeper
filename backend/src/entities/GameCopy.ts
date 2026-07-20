import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Game } from "./Game";

export enum CopyCondition {
  NEW = "new",
  GOOD = "good",
  WORN = "worn",
  DAMAGED = "damaged"
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

  @Column({ name: "copy_number", nullable: true })
  copyNumber!: string;

  @Column({ name: "is_available", default: true })
  isAvailable!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}