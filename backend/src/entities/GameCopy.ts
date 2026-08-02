import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Game } from "./Game";
import { Rental } from "./Rental";

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

  @OneToMany(() => Rental, (rental) => rental.gameCopy)
  rentals!: Rental[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}