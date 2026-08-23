import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../patient/patient.entity';

@Entity('smartbox_dose_events')
export class SmartboxDoseEvent {
  @PrimaryGeneratedColumn('uuid')
  event_id: string;

  @Column()
  device_id: string;

  @Column({ type: 'int' })
  bin_index: number;

  @Column({ type: 'timestamptz' })
  dose_timestamp: Date;

  @Column({ type: 'boolean' })
  confirmed: boolean;

  @Column({ type: 'float', nullable: true })
  weight_before: number | null;

  @Column({ type: 'float', nullable: true })
  weight_after: number | null;

  @Column({ type: 'float' })
  weight_left_g: number;

  @Column({ type: 'int', default: 0 })
  score_impact: number;

  @Column({ type: 'jsonb', default: {} })
  raw_payload: Record<string, unknown>;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  patient: Patient | null;

  @CreateDateColumn()
  received_at: Date;
}
