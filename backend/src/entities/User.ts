import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
import { Role } from "../permissions";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: "password_hash" })
  passwordHash!: string;

  @Column({ default: Role.STAFF })
  role!: Role;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "reset_code", nullable: true })
  resetCode!: string;

  @Column({ name: "reset_code_requested_at", type: "datetime", nullable: true })
  resetCodeRequestedAt!: Date;

  @Column({ name: "reset_code_expires_at", type: "datetime", nullable: true })
  resetCodeExpiresAt!: Date;

  @Column({ name: "is_approved", default: false })
  isApproved!: boolean;

  @Column({ name: "last_login_at", type: "datetime", nullable: true })
  lastLoginAt!: Date | null;
}