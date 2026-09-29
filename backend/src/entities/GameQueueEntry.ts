import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { Game } from "./Game";
import { Member } from "./Member";

@Entity()
@Unique(["game", "member"])
export class GameQueueEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "game_id" })
  game!: Game;

  @ManyToOne(() => Member, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "member_id" })
  member!: Member;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
