import { dateOnly } from './date-only';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { MedicationSchedule, IntakeStatus } from './medication-schedule.entity';
import { MedicationInfo } from './medication.entity';
import { Patient } from '../patient/patient.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateIntakeDto } from './dto/update-intake.dto';
import { NotificationService } from '../notification/notification.service';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../notification/notification.entity';

@Injectable()
export class MedicationScheduleService {
  constructor(
    @InjectRepository(MedicationSchedule)
    private readonly scheduleRepository: Repository<MedicationSchedule>,
    @InjectRepository(MedicationInfo)
    private readonly medicationRepository: Repository<MedicationInfo>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create medication schedules for a patient's medication
   * This generates schedule entries for the next 7 days
   */
  async createSchedule(patientId: string, dto: CreateScheduleDto) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const medication = await this.medicationRepository.findOne({
      where: {
        medication_id: dto.medication_id,
        patient: { patient_id: patientId },
      },
      relations: ['patient'],
    });

    if (!medication) {
      throw new NotFoundException('Medication not found for this patient');
    }

    // Validate that times array length matches frequency
    if (dto.times.length !== medication.frequency) {
      throw new BadRequestException(
        `Number of times (${dto.times.length}) must match medication frequency (${medication.frequency})`,
      );
    }

    const today = new Date();
    const todayKey = dateOnly(today);
    const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const duration = Number(
      medication.period.match(/^(\d+)\s*days?$/i)?.[1] ?? 7,
    );
    const daysToSchedule = Math.min(90, Math.max(1, duration));
    return this.scheduleRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        patientId + ':' + dto.medication_id,
      ]);
      if (dto.replace_pending) {
        const previous = await manager.find(MedicationSchedule, {
          where: {
            patient: { patient_id: patientId },
            medication: { medication_id: dto.medication_id },
            status: IntakeStatus.PENDING,
          },
        });
        const future = previous.filter(
          (s) =>
            s.scheduled_date > todayKey ||
            (s.scheduled_date === todayKey &&
              s.scheduled_time.slice(0, 5) >= nowTime),
        );
        if (future.length) await manager.remove(MedicationSchedule, future);
        const reminders = await manager.find(Notification, {
          where: {
            patient: { patient_id: patientId },
            status: NotificationStatus.PENDING,
          },
        });
        const related = reminders.filter(
          (n) =>
            n.metadata?.medication_id === dto.medication_id &&
            n.scheduled_for >= today,
        );
        if (related.length) await manager.remove(Notification, related);
      }
      const schedules: MedicationSchedule[] = [];
      for (let day = 0; day < daysToSchedule; day++) {
        const calendar = new Date(today);
        calendar.setDate(calendar.getDate() + day);
        const date = dateOnly(calendar);
        for (const time of dto.times) {
          if (day === 0 && time < nowTime) continue;
          const existing = await manager.findOne(MedicationSchedule, {
            where: {
              medication: { medication_id: dto.medication_id },
              scheduled_date: date,
              scheduled_time: time,
            },
          });
          if (!existing)
            schedules.push(
              manager.create(MedicationSchedule, {
                patient,
                medication,
                scheduled_date: date,
                scheduled_time: time,
                status: IntakeStatus.PENDING,
              }),
            );
        }
      }
      const saved = await manager.save(MedicationSchedule, schedules);
      const prescription = medication.prescription as { name?: string };
      const reminders = saved.map((schedule) =>
        manager.create(Notification, {
          patient,
          title: 'Medication reminder',
          message:
            'Your scheduled medication is ready for review: ' +
            (prescription.name ?? 'Medication'),
          type: NotificationType.MEDICATION_REMINDER,
          status: NotificationStatus.PENDING,
          metadata: {
            medication_id: medication.medication_id,
            schedule_id: schedule.schedule_id,
          },
          scheduled_for: new Date(
            schedule.scheduled_date +
              'T' +
              schedule.scheduled_time.slice(0, 5) +
              ':00',
          ),
        }),
      );
      if (reminders.length) await manager.save(Notification, reminders);
      return {
        message: `Created ${saved.length} schedule entries for the next ${daysToSchedule} days`,
        schedules: saved,
      };
    });
  }

  /**
   * Get upcoming medications for today
   * Returns medications that are pending and scheduled for today
   */
  async getUpcomingMedications(patientId: string) {
    const today = dateOnly();
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const schedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        scheduled_date: today,
      },
      relations: ['medication'],
      order: { scheduled_time: 'ASC' },
    });

    return schedules.map((schedule) => {
      const [schedHours, schedMinutes] = schedule.scheduled_time
        .split(':')
        .map(Number);
      const [currHours, currMinutes] = currentTime.split(':').map(Number);

      const schedTotalMinutes = schedHours * 60 + schedMinutes;
      const currTotalMinutes = currHours * 60 + currMinutes;
      const diffMinutes = schedTotalMinutes - currTotalMinutes;

      let timeUntil: string;
      if (schedule.status === IntakeStatus.TAKEN) {
        timeUntil = 'Taken';
      } else if (schedule.status === IntakeStatus.MISSED) {
        timeUntil = 'Missed';
      } else if (schedule.status === IntakeStatus.SKIPPED) {
        timeUntil = 'Skipped';
      } else if (diffMinutes < 0) {
        timeUntil = 'Overdue';
      } else if (diffMinutes < 60) {
        timeUntil = `in ${diffMinutes} minutes`;
      } else {
        const hours = Math.floor(diffMinutes / 60);
        timeUntil = `in ${hours} hour${hours > 1 ? 's' : ''}`;
      }

      return {
        schedule_id: schedule.schedule_id,
        medication_id: schedule.medication.medication_id,
        medication_name:
          (schedule.medication.prescription as any)?.prescription?.[0]?.name ||
          (schedule.medication.prescription as any)?.name ||
          'Medication',
        prescription: schedule.medication.prescription,
        scheduled_time: schedule.scheduled_time,
        scheduled_date: schedule.scheduled_date,
        status: schedule.status,
        time_until: timeUntil,
        taken_at: schedule.taken_at,
        notes: schedule.notes,
        confirmation_source: schedule.confirmation_source,
      };
    });
  }

  /**
   * Get general status for today
   * Returns counts of taken, missed, and pending medications
   */
  async getGeneralStatus(patientId: string) {
    const today = dateOnly();
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const todaySchedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        scheduled_date: today,
      },
      relations: ['medication'],
    });

    return {
      date: today,
      medications_taken_today: todaySchedules.filter(
        (s) => s.status === IntakeStatus.TAKEN,
      ).length,
      medications_missed: todaySchedules.filter(
        (s) => s.status === IntakeStatus.MISSED,
      ).length,
      medications_pending: todaySchedules.filter(
        (s) => s.status === IntakeStatus.PENDING,
      ).length,
      medications_skipped: todaySchedules.filter(
        (s) => s.status === IntakeStatus.SKIPPED,
      ).length,
      medications_overdue: todaySchedules.filter(
        (s) =>
          s.status === IntakeStatus.PENDING &&
          s.scheduled_time.slice(0, 5) < currentTime,
      ).length,
      total_scheduled: todaySchedules.length,
    };
  }

  /**
   * Mark a medication intake as taken, missed, or skipped
   */
  async updateIntakeStatus(
    patientId: string,
    scheduleId: string,
    dto: UpdateIntakeDto,
  ) {
    const schedule = await this.scheduleRepository.findOne({
      where: {
        schedule_id: scheduleId,
        patient: { patient_id: patientId },
      },
      relations: ['medication'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found for this patient');
    }

    const previousStatus = schedule.status;
    schedule.status = dto.status;

    if (dto.status === IntakeStatus.TAKEN) {
      schedule.taken_at = new Date();
      schedule.confirmation_source = 'patient';
    } else {
      schedule.taken_at = null;
      schedule.confirmation_source =
        dto.status === IntakeStatus.PENDING ? null : 'patient';
    }

    if (dto.notes !== undefined) {
      schedule.notes = dto.notes;
    } else if (previousStatus !== dto.status) {
      // A correction must not retain a reason belonging to the previous status.
      schedule.notes = '';
    }

    return this.scheduleRepository.save(schedule);
  }

  /**
   * Mark a medication as taken by schedule ID
   */
  async markAsTaken(patientId: string, scheduleId: string, notes?: string) {
    return this.updateIntakeStatus(patientId, scheduleId, {
      status: IntakeStatus.TAKEN,
      notes,
    });
  }

  /**
   * Get schedule history for a patient (all time or date range)
   */
  async getScheduleHistory(
    patientId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {
      patient: { patient_id: patientId },
    };

    if (startDate && endDate) {
      where.scheduled_date = Between(startDate, endDate);
    }

    return this.scheduleRepository.find({
      where,
      relations: ['medication'],
      order: { scheduled_date: 'DESC', scheduled_time: 'DESC' },
    });
  }

  /**
   * Get schedules for a specific medication
   */
  async getMedicationSchedules(patientId: string, medicationId: string) {
    return this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        medication: { medication_id: medicationId },
      },
      order: { scheduled_date: 'ASC', scheduled_time: 'ASC' },
    });
  }

  /**
   * Delete schedules for a medication
   */
  async deleteSchedules(patientId: string, medicationId: string) {
    const schedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        medication: { medication_id: medicationId },
      },
    });

    await this.scheduleRepository.remove(schedules);
    return { message: `Deleted ${schedules.length} schedule entries` };
  }

  /**
   * Get weekly adherence statistics
   */
  async getWeeklyAdherence(patientId: string) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const startDate = dateOnly(weekAgo);
    const endDate = dateOnly(today);

    const schedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        scheduled_date: Between(startDate, endDate),
      },
    });

    const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const due = schedules.filter(
      (s) =>
        s.status !== IntakeStatus.PENDING ||
        s.scheduled_date < endDate ||
        s.scheduled_time.slice(0, 5) <= nowTime,
    );
    const total = due.length;
    const taken = due.filter((s) => s.status === IntakeStatus.TAKEN).length;
    const patientReportedTaken = due.filter(
      (s) =>
        s.status === IntakeStatus.TAKEN && s.confirmation_source === 'patient',
    ).length;
    const unattributedTaken = taken - patientReportedTaken;
    const unreported = due.filter(
      (s) => s.status === IntakeStatus.PENDING,
    ).length;
    const missed = due.filter((s) => s.status === IntakeStatus.MISSED).length;
    const skipped = due.filter((s) => s.status === IntakeStatus.SKIPPED).length;

    return {
      period: { start: startDate, end: endDate },
      total_scheduled: total,
      taken,
      patient_reported_taken: patientReportedTaken,
      unattributed_taken: unattributedTaken,
      unreported,
      upcoming: schedules.length - total,
      missed,
      skipped,
      // Retain the legacy response keys, but never count unattributed history
      // as a patient report or silently remove unknown entries from the denominator.
      adherence_rate:
        total > 0 ? Math.round((patientReportedTaken / total) * 100) : 0,
    };
  }
}
