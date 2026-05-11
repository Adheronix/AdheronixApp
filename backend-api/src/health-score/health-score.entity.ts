import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Patient } from '../patient/patient.entity';

@Entity('health_scores')
export class HealthScore {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  score_id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  patient: Patient;

  @ApiProperty({ example: 750 })
  @Column({ type: 'int', default: 500 })
  score: number;

  @ApiProperty({ example: 12 })
  @Column({ type: 'int', default: 0 })
  delta: number;

  @ApiProperty({ example: 'dose_taken' })
  @Column({ nullable: true })
  reason: string;

  @ApiProperty({ example: 95 })
  @Column({ type: 'float', default: 100 })
  adherence_percentage: number;

  @ApiProperty({ example: 3 })
  @Column({ type: 'int', default: 0 })
  streak_current: number;

  @ApiProperty({ example: 14 })
  @Column({ type: 'int', default: 0 })
  streak_best: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  missed_critical: number;

  @ApiProperty()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
