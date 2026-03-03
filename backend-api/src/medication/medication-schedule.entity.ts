import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { MedicationInfo } from './medication.entity';
import { Patient } from '../patient/patient.entity';

export enum IntakeStatus {
  PENDING = 'pending',
  TAKEN = 'taken',
  MISSED = 'missed',
  SKIPPED = 'skipped',
}

@Entity('medication_schedules')
export class MedicationSchedule {
  @ApiProperty({ example: '7d5e46c3-1678-456b-a241-11d27931862d' })
  @PrimaryGeneratedColumn('uuid')
  schedule_id: string;

  @ManyToOne(() => MedicationInfo, { onDelete: 'CASCADE' })
  medication: MedicationInfo;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  patient: Patient;

  @ApiProperty({ example: '08:00' })
  @Column({ type: 'time' })
  scheduled_time: string; // e.g., "08:00" or "14:30"

  @ApiProperty({ example: '2026-02-01' })
  @Column({ type: 'date' })
  scheduled_date: string; // e.g., "2026-02-01"

  @ApiProperty({ enum: IntakeStatus, default: IntakeStatus.PENDING })
  @Column({
    type: 'enum',
    enum: IntakeStatus,
    default: IntakeStatus.PENDING,
  })
  status: IntakeStatus;

  @ApiProperty({ example: '2026-02-01T08:05:00Z', required: false })
  @Column({ nullable: true })
  taken_at: Date;

  @ApiProperty({ example: 'Missed because I was away', required: false })
  @Column({ nullable: true, type: 'text' })
  notes: string;

  @ApiProperty()
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updated_at: Date;
}
