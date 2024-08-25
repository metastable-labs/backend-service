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

@Entity({
  name: 'wallets',
})
export class Wallet {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId | undefined;

  @PrimaryColumn()
  id: string;

  @Column()
  wallet_address: string;

  @Column()
  total_balance: number;

  @Column()
  pending_balance: number;

  @Column()
  xpMigrate_earned: number;

  @Column()
  is_active: boolean;

  @Column()
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  rank: number;
}
