import {
  Column,
  CreateDateColumn,
  Entity,
  ObjectId,
  ObjectIdColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Providers } from '../interfaces/liquidity.interface';

@Entity({
  name: 'liquidity_pools',
})
export class LiquidityPool {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId;

  @PrimaryColumn()
  id: string;

  @Column('jsonb', { array: true })
  providers: Providers;

  @Column()
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
