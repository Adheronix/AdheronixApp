import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationStatus,
} from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Patient } from '../patient/patient.entity';
import { PushNotificationService } from './channels/push-notification.service';
import { EmailNotificationService } from './channels/email-notification.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly pushService: PushNotificationService,
    private readonly emailService: EmailNotificationService,
  ) {}

  async create(patientId: string, dto: CreateNotificationDto) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const notification = this.notificationRepository.create({
      patient,
      title: dto.title,
      message: dto.message,
      type: dto.type || NotificationType.GENERAL,
      metadata: dto.metadata,
      scheduled_for: dto.scheduled_for
        ? new Date(dto.scheduled_for)
        : undefined,
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepository.save(notification);

    // If not scheduled, send immediately
    if (!dto.scheduled_for) {
      await this.sendNotification(saved);
    }

    return saved;
  }

  async createForAllPatients(dto: CreateNotificationDto) {
    const patients = await this.patientRepository.find();
    const notifications: Notification[] = [];

    for (const patient of patients) {
      const notification = this.notificationRepository.create({
        patient,
        title: dto.title,
        message: dto.message,
        type: dto.type || NotificationType.GENERAL,
        metadata: dto.metadata,
        scheduled_for: dto.scheduled_for
          ? new Date(dto.scheduled_for)
          : undefined,
        status: NotificationStatus.PENDING,
      });
      notifications.push(notification);
    }

    const saved = await this.notificationRepository.save(notifications);

    // Send immediately if not scheduled
    if (!dto.scheduled_for) {
      for (const notification of saved) {
        await this.sendNotification(notification);
      }
    }

    return saved;
  }

  async findAllForPatient(patientId: string, unreadOnly = false) {
    const where: any = { patient: { patient_id: patientId } };

    if (unreadOnly) {
      where.status = NotificationStatus.SENT;
      where.read_at = IsNull();
    }

    return this.notificationRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOneForPatient(patientId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: {
        notification_id: notificationId,
        patient: { patient_id: patientId },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markAsRead(patientId: string, notificationId: string) {
    const notification = await this.findOneForPatient(
      patientId,
      notificationId,
    );

    notification.status = NotificationStatus.READ;
    notification.read_at = new Date();

    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(patientId: string) {
    const result = await this.notificationRepository.update(
      {
        patient: { patient_id: patientId },
        status: NotificationStatus.SENT,
      },
      {
        status: NotificationStatus.READ,
        read_at: new Date(),
      },
    );

    return { affected: result.affected || 0 };
  }

  async update(
    patientId: string,
    notificationId: string,
    dto: UpdateNotificationDto,
  ) {
    const notification = await this.findOneForPatient(
      patientId,
      notificationId,
    );

    if (dto.status) {
      notification.status = dto.status;
      if (dto.status === NotificationStatus.READ && !notification.read_at) {
        notification.read_at = new Date();
      }
    }

    return this.notificationRepository.save(notification);
  }

  async remove(patientId: string, notificationId: string) {
    const notification = await this.findOneForPatient(
      patientId,
      notificationId,
    );
    await this.notificationRepository.remove(notification);
    return { message: 'Notification deleted' };
  }

  async getPendingNotifications() {
    return this.notificationRepository.find({
      where: {
        status: NotificationStatus.PENDING,
        scheduled_for: LessThanOrEqual(new Date()),
      },
      relations: ['patient'],
    });
  }

  async sendNotification(notification: Notification) {
    try {
      this.logger.log(
        `Processing notification ${notification.notification_id} for patient ${notification.patient.patient_id}`,
      );

      const patient = notification.patient;

      // 1. Send Push Notification if enabled and token exists
      if (patient.push_notifications_enabled && patient.fcm_token) {
        await this.pushService.send({
          token: patient.fcm_token,
          title: notification.title,
          body: notification.message,
          data: notification.metadata,
        });
      } else {
        this.logger.log(
          `Skipping push for patient ${patient.patient_id}: Enabled=${patient.push_notifications_enabled}, Token=${!!patient.fcm_token}`,
        );
      }

      // 2. Send Email if enabled
      if (patient.email_notifications_enabled && patient.email) {
        await this.emailService.send({
          to: patient.email,
          subject: notification.title,
          text: notification.message,
        });
      }

      notification.status = NotificationStatus.SENT;
      notification.sent_at = new Date();

      await this.notificationRepository.save(notification);

      this.logger.log(
        `Notification ${notification.notification_id} sent successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send notification ${notification.notification_id}: ${error.message}`,
      );
      notification.status = NotificationStatus.FAILED;
      await this.notificationRepository.save(notification);
      // Don't throw error to prevent crashing a batch process
    }
  }

  async createMedicationReminder(
    patientId: string,
    medicationId: string,
    medicationName: string,
    scheduledTime: Date,
  ) {
    return this.create(patientId, {
      title: 'Medication Reminder',
      message: `Time to take your medication: ${medicationName}`,
      type: NotificationType.MEDICATION_REMINDER,
      metadata: {
        medication_id: medicationId,
        medication_name: medicationName,
      },
      scheduled_for: scheduledTime.toISOString(),
    });
  }

  async getUnreadCount(patientId: string) {
    return this.notificationRepository.count({
      where: {
        patient: { patient_id: patientId },
        status: NotificationStatus.SENT,
        read_at: IsNull(),
      },
    });
  }

  async createSchedule(
    patientId: string,
    medicationId: string,
    times: string[],
  ) {
    const medication = (await this.notificationRepository.manager.findOne(
      'MedicationInfo',
      {
        where: { medication_id: medicationId },
        relations: ['patient'],
      },
    )) as any;

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    if (medication.patient.patient_id !== patientId) {
      throw new NotFoundException('Medication not found for this patient');
    }

    if (times.length !== medication.frequency) {
      throw new Error(
        `Number of times provided (${times.length}) does not match medication frequency (${medication.frequency})`,
      );
    }

    // Schedule for the next 7 days
    const notifications: Notification[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      for (const timeStr of times) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const scheduledFor = new Date(date);
        scheduledFor.setHours(hours, minutes, 0, 0);

        // If time has passed for today, skip
        if (scheduledFor < new Date()) continue;

        notifications.push(
          this.notificationRepository.create({
            patient: medication.patient,
            title: `Time to take ${medication.prescription?.name || 'Medication'}`,
            message: `It is time to take your dose of ${medication.prescription?.name || 'medication'}.`,
            type: NotificationType.MEDICATION_REMINDER,
            metadata: {
              medication_id: medication.medication_id,
              scheduled_time: timeStr,
            },
            scheduled_for: scheduledFor,
            status: NotificationStatus.PENDING,
          }),
        );
      }
    }

    return this.notificationRepository.save(notifications);
  }
}
