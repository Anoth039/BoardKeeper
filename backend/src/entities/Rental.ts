import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Member } from "./Member";
import { GameCopy } from "./GameCopy";

export enum RentalStatus {
  ACTIVE = "active",
  RETURNED = "returned",
  OVERDUE = "overdue",
}

@Entity()
export class Rental {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Member, (member) => member.rentals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "member_id" })
  member!: Member;

  @ManyToOne(() => GameCopy, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "game_copy_id" })
  gameCopy!: GameCopy | null;

  @Column({ name: "rental_date", type: "date" })
  rentalDate!: string;

  @Column({ name: "due_date", type: "date" })
  dueDate!: string;

  @Column({ name: "return_date", type: "date", nullable: true })
  returnDate!: string | null;

  @Column({
    type: "enum",
    enum: RentalStatus,
    default: RentalStatus.ACTIVE,
  })
  status!: RentalStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "game_title_snapshot", nullable: true })
  gameTitleSnapshot!: string;

  @Column({ name: "copy_label_snapshot", nullable: true })
  copyLabelSnapshot!: string;
}