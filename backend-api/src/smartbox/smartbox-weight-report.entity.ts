import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../patient/patient.entity';

@Entity('smartbox_weight_reports')
export class SmartboxWeightReport {
  @PrimaryGeneratedColumn('uuid')
  report_id: string;

  @Column()
  device_id: string;

  @Column({ type: 'float' })
  weight_g: number;

  @Column({ type: 'int', nullable: true })
  pills_est: number | null;

  @Column({ default: 'loadcell' })
  source: string;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  patient: Patient | null;

  @CreateDateColumn()
  reported_at: Date;
}
