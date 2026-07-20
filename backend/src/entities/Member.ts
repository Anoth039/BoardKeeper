import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { Rental } from "./Rental";

@Entity()
export class Member {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "first_name" })
  firstName!: string;

  @Column({ name: "last_name" })
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @OneToMany(() => Rental, (rental) => rental.member)
  rentals!: Rental[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}