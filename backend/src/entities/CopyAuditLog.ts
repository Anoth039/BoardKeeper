import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { GameCopy } from "./GameCopy";
import { User } from "./User";

export enum AuditAction {
  CREATED = "created",
  CONDITION_CHANGED = "condition_changed",
  NAME_CHANGED = "name_changed",
  NOTES_CHANGED = "notes_changed",
  DELETED = "deleted",
}

@Entity()
export class CopyAuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => GameCopy, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "copy_id" })
  copy!: GameCopy | null;

  @Column({ name: "copy_number_snapshot" })
  copyNumberSnapshot!: string;

  @Column({ name: "game_id" })
  gameId!: number;

  @Column({ type: "enum", enum: AuditAction })
  action!: AuditAction;

  @Column({ name: "old_value", type: "text", nullable: true })
  oldValue!: string | null;

  @Column({ name: "new_value", type: "text", nullable: true })
  newValue!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "performed_by_user_id" })
  performedBy!: User | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}