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

export enum NotificationType {
  MEDICATION_REMINDER = 'medication_reminder',
  MEDICATION_UPDATE = 'medication_update',
  MEDICATION_EXPIRY = 'medication_expiry',
  SYSTEM_ALERT = 'system_alert',
  GENERAL = 'general',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('notifications')
export class Notification {
  @ApiProperty({ example: '7d5e46c3-1678-456b-a241-11d27931862d' })
  @PrimaryGeneratedColumn('uuid')
  notification_id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  patient: Patient;

  @ApiProperty({ enum: NotificationType, default: NotificationType.GENERAL })
  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.GENERAL,
  })
  type: NotificationType;

  @ApiProperty({ example: 'Medication Reminder' })
  @Column()
  title: string;

  @ApiProperty({ example: 'Time to take your Amoxicillin' })
  @Column('text')
  message: string;

  @ApiProperty({ example: { medication_id: '123' }, required: false })
  @Column('json', { nullable: true })
  metadata: Record<string, unknown>;

  @ApiProperty({
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @ApiProperty({ example: '2026-02-01T08:00:00Z', required: false })
  @Column({ nullable: true })
  scheduled_for: Date;

  @ApiProperty({ example: '2026-02-01T08:00:05Z', required: false })
  @Column({ nullable: true })
  sent_at: Date;

  @ApiProperty({ example: '2026-02-01T08:10:00Z', required: false })
  @Column({ nullable: true })
  read_at: Date;

  @ApiProperty()
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updated_at: Date;
}
