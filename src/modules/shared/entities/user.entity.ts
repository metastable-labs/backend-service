import { Exclude } from 'class-transformer';
import { LaunchboxApiCredential } from '../../launchbox/entities/launchbox.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ObjectId,
  ObjectIdColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@privy-io/server-auth';
import { SharedWallet } from './wallet.entity';

@Entity({
  name: 'shared_users',
})
export class SharedUser {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId | undefined;

  @PrimaryColumn()
  id: string;

  @Exclude()
  @Column()
  reference: string | undefined;

  @Column()
  auth_id: string;

  @Column()
  auth_type: string;

  @Column()
  wallet_address: string;

  @Column()
  is_active: boolean;

  @Column()
  referral_code: string;

  @Exclude()
  @Column({ type: 'jsonb' })
  payload: User | undefined;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  wallet: SharedWallet;
  externalApiCall?: boolean;
  apiCredential?: LaunchboxApiCredential;
}
