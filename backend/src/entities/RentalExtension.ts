import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Rental } from "./Rental";
import { User } from "./User";
import { decimalTransformer } from "../utils/money";

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

  @Column({ name: "fee_charged", type: "decimal", precision: 8, scale: 2, default: 0, transformer: decimalTransformer })
  feeCharged!: number;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "extended_by_user_id" })
  extendedBy!: User | null;

  @CreateDateColumn({ name: "extended_at" })
  extendedAt!: Date;
}