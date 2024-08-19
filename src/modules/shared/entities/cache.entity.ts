import { Column, CreateDateColumn, Entity, ObjectIdColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('shared_cache')
export class SharedCache {
  @ObjectIdColumn()
  _id: string;

  @PrimaryColumn()
  id: string;

  @Column()
  key: string;

  @Column({ type: 'json' })
  value: Record<string, string | number | boolean>;

  @Column()
  expires: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
