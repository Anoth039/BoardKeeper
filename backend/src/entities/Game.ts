import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { GameCopy } from "./GameCopy";

export enum AgeRating {
  AGE_3 = 3,
  AGE_7 = 7,
  AGE_12 = 12,
  AGE_16 = 16,
  AGE_18 = 18,
}

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

  @Column({
    name: "age_rating",
    type: "enum",
    enum: AgeRating,
    nullable: true,
  })
  ageRating!: AgeRating;

  @Column({ name: "estimated_time_minutes", nullable: true })
  estimatedTimeMinutes!: number;

  @OneToMany(() => GameCopy, (copy) => copy.game)
  copies!: GameCopy[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}