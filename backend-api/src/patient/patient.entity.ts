import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { MedicationInfo } from '../medication/medication.entity';
import { UserRole } from '../auth/user-role.enum';

@Entity('auth_patient')
export class Patient {
  @ApiProperty({ example: '7d5e46c3-1678-456b-a241-11d27931862d' })
  @PrimaryGeneratedColumn('uuid')
  patient_id: string;

  @ApiProperty({ example: 'patient@example.com' })
  @Column({ unique: true, nullable: true })
  email: string;

  @ApiProperty({ example: 'janedoe' })
  @Column({ unique: true })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  @Column({ nullable: true })
  full_names: string;

  @ApiProperty({ example: '+1234567890' })
  @Column({ nullable: true, unique: true })
  phone_number: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  fcm_token: string;

  @Column({ default: true })
  push_notifications_enabled: boolean;

  @Column({ default: true })
  email_notifications_enabled: boolean;

  @ApiProperty({ enum: UserRole, default: UserRole.PATIENT })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PATIENT,
  })
  role: UserRole;

  @ApiProperty()
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => MedicationInfo, (medication) => medication.patient)
  medications: MedicationInfo[];
}
