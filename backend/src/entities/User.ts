import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: "password_hash" })
  passwordHash!: string;

  @Column({ default: "staff" })
  role!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "verification_code", nullable: true })
  verificationCode!: string;

  @Column({ name: "verification_code_expires_at", type: "datetime", nullable: true })
  verificationCodeExpiresAt!: Date;

  @Column({ name: "verification_code_requested_at", type: "datetime", nullable: true })
  verificationCodeRequestedAt!: Date;

  @Column({ name: "reset_code", nullable: true })
  resetCode!: string;

  @Column({ name: "reset_code_requested_at", type: "datetime", nullable: true })
  resetCodeRequestedAt!: Date;

  @Column({ name: "reset_code_expires_at", type: "datetime", nullable: true })
  resetCodeExpiresAt!: Date;
}