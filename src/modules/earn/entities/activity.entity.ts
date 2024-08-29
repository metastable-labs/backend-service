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
import { ActivitySlug } from '../enums/earn.enum';
import { Multiplier } from '../interfaces/earn.interface';

@Entity({
  name: 'earn_activities',
})
export class Activity {
  @Exclude()
  @ObjectIdColumn({ select: false })
  _id: ObjectId;

  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  slug: ActivitySlug;

  @Column()
  description: string;

  @Column()
  points: number;

  @Column()
  mint_url: string;

  @Column({ default: false })
  is_percentage_based: boolean;

  @Column({ default: 0 })
  percentage: number;

  @Column()
  is_active: boolean;

  @Column()
  multipliers: Multiplier[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
