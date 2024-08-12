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

@Entity({
  name: 'shared_users',
})
export class SharedUser {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId;

  @PrimaryColumn()
  id: string;

  @Exclude()
  @Column()
  reference: string;

  @Column()
  auth_id: string;

  @Column()
  auth_type: string;

  @Column()
  wallet_address: string;

  @Column()
  is_active: boolean;

  @Exclude()
  @Column({ type: 'jsonb' })
  payload: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  externalApiCall?: boolean;
  apiCredential?: LaunchboxApiCredential;
}
