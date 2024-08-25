import {
  Column,
  CreateDateColumn,
  Entity,
  ObjectId,
  ObjectIdColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Chain, PullRequest } from '../interfaces/migration.interface';
import { Exclude } from 'class-transformer';
import { Status } from '../enums/migration.enum';

@Entity({
  name: 'migrations',
})
export class Migration {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId;

  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  decimals: number;

  @Column()
  logo_url: string;

  @Column()
  description: string;

  @Column()
  website: string;

  @Column()
  twitter: string;

  @Column()
  chains: Chain[];

  @Column()
  pull_requests: PullRequest[];

  @Column()
  status: Status;

  @Column()
  featured: boolean;

  @Column()
  is_custom: boolean;

  @Exclude()
  @Column({ select: false })
  metadata: Record<string, any>;

  @Column()
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
