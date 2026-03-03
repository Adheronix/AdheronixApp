import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Patient } from '../patient/patient.entity';
import { MedicationSchedule } from './medication-schedule.entity';

@Entity('medication_info')
export class MedicationInfo {
  @ApiProperty({ example: '7d5e46c3-1678-456b-a241-11d27931862d' })
  @PrimaryGeneratedColumn('uuid')
  medication_id: string;

  @ManyToOne(() => Patient, (patient) => patient.medications, {
    onDelete: 'CASCADE',
  })
  patient: Patient;

  @ApiProperty({ example: { name: 'Amoxicillin', dose: '500mg' } })
  @Column('json')
  prescription: Record<string, unknown>;

  @ApiProperty({ example: 'Take after meals' })
  @Column()
  intake_recommendation: string;

  @ApiProperty({ example: '7 days' })
  @Column()
  period: string;

  @ApiProperty({ example: 'clinician' })
  @Column()
  source: string;

  @ApiProperty({ example: 3 })
  @Column({ type: 'int', default: 1 })
  frequency: number;

  @ApiProperty()
  @CreateDateColumn()
  issued_at: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => MedicationSchedule, (schedule) => schedule.medication)
  schedules: MedicationSchedule[];
}
