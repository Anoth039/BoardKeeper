import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Rental } from "./Rental";
import { User } from "./User";

@Entity()
export class RentalExtension {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Rental, { onDelete: "CASCADE" })
  @JoinColumn({ name: "rental_id" })
  rental!: Rental;

  @Column({ name: "previous_due_date", type: "date" })
  previousDueDate!: string;

  @Column({ name: "new_due_date", type: "date" })
  newDueDate!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "extended_by_user_id" })
  extendedBy!: User | null;

  @CreateDateColumn({ name: "extended_at" })
  extendedAt!: Date;
}