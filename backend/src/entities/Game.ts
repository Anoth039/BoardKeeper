import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { GameCopy } from "./GameCopy";

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ name: "min_players" })
  minPlayers!: number;

  @Column({ name: "max_players" })
  maxPlayers!: number;

  @Column({ nullable: true })
  category!: string;

  @Column({ name: "image_url", nullable: true })
  imageUrl!: string;

  @OneToMany(() => GameCopy, (copy) => copy.game)
  copies!: GameCopy[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}