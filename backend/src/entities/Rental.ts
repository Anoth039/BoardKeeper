import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Member } from "./Member";
import { GameCopy } from "./GameCopy";
import { User } from "./User";

export enum RentalStatus {
  ACTIVE = "active",
  RETURNED = "returned",
  OVERDUE = "overdue",
}

@Entity()
export class Rental {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Member, (member) => member.rentals, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "member_id" })
  member!: Member | null;

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

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "handled_by_user_id" })
  handledBy!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "returned_by_user_id" })
  returnedBy!: User | null;

  @Column({ name: "game_title_snapshot", nullable: true })
  gameTitleSnapshot!: string;

  @Column({ name: "copy_label_snapshot", nullable: true })
  copyLabelSnapshot!: string;
}