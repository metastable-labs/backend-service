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
  name: 'shared_wallets',
})
export class SharedWallet {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId | undefined;

  @PrimaryColumn()
  id: string;

  @Column()
  total_balance: number;

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
