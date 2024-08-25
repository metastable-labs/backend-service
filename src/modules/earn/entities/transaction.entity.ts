import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  ObjectId,
  ObjectIdColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionStatus, TransactionType } from '../enums/earn.enum';

@Entity({
  name: 'earn_transactions',
})
export class Transaction {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId;

  @PrimaryColumn()
  id: string;

  @Column()
  wallet_id: string;

  @Column()
  activity_id: string;

  @Column()
  points: number;

  @Column()
  xpMigrate: number;

  @Column()
  description: string;

  @Column()
  type: TransactionType;

  @Column()
  status: TransactionStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  totalPoints: number;
}
