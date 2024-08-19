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
import { Wallet } from '../../shared/entities/wallet.entity';
import { LaunchboxApiCredential } from '../../launchbox/entities/launchbox.entity';
import { GithubAuth } from '../interfaces/shared.interface';

@Entity({
  name: 'users',
})
export class User {
  @ObjectIdColumn({ select: false })
  @Exclude()
  _id: ObjectId | undefined;

  @PrimaryColumn()
  id: string;

  @Column()
  reference: string | undefined;

  @Exclude()
  @Column({ unique: true, select: false, nullable: true })
  github_id: number;

  @Column()
  auth_id: string;

  @Column()
  auth_type: string;

  @Column()
  wallet_address: string;

  @Column()
  name: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column()
  ip_address: string;

  @Column()
  referral_code: string;

  @Column()
  is_active: boolean;

  @Exclude()
  @Column({ select: false, nullable: true })
  github_auth: GithubAuth | undefined;

  @Exclude()
  @Column({ select: false })
  metadata: User | Record<string, any> | undefined;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  wallet: Wallet;
  externalApiCall?: boolean;
  apiCredential?: LaunchboxApiCredential;
}
