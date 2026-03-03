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

    const schedules: MedicationSchedule[] = [];
    const today = new Date();
    const daysToSchedule = 7; // Schedule for the next 7 days

    for (let day = 0; day < daysToSchedule; day++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(scheduleDate.getDate() + day);
      const dateString = scheduleDate.toISOString().split('T')[0];

      for (const time of dto.times) {
        // Skip times that have already passed today
        if (day === 0) {
          const [hours, minutes] = time.split(':').map(Number);
          const scheduledDateTime = new Date(scheduleDate);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
          if (scheduledDateTime < today) {
            continue;
          }
        }

        // Check if a schedule already exists for this date/time/medication
        const existing = await this.scheduleRepository.findOne({
          where: {
            medication: { medication_id: dto.medication_id },
            scheduled_date: dateString,
            scheduled_time: time,
          },
        });

        if (!existing) {
          const schedule = this.scheduleRepository.create({
            patient,
            medication,
            scheduled_date: dateString,
            scheduled_time: time,
            status: IntakeStatus.PENDING,
          });
          schedules.push(schedule);
        }
      }
    }

    const saved = await this.scheduleRepository.save(schedules);

    // Also create notification reminders for each scheduled time
    for (const schedule of saved) {
      const [hours, minutes] = schedule.scheduled_time.split(':').map(Number);
      const scheduledFor = new Date(
        `${schedule.scheduled_date}T${schedule.scheduled_time}:00`,
      );

      if (scheduledFor > new Date()) {
        await this.notificationService.createMedicationReminder(
          patientId,
          medication.medication_id,
          (medication.prescription as any)?.prescription?.[0]?.name ||
            (medication.prescription as any)?.name ||
            'Medication',
          scheduledFor,
        );
      }
    }

    return {
      message: `Created ${saved.length} schedule entries for the next ${daysToSchedule} days`,
      schedules: saved,
    };
  }

  /**
   * Get upcoming medications for today
   * Returns medications that are pending and scheduled for today
   */
  async getUpcomingMedications(patientId: string) {
    const today = new Date().toISOString().split('T')[0];
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
      };
    });
  }

  /**
   * Get general status for today
   * Returns counts of taken, missed, and pending medications
   */
  async getGeneralStatus(patientId: string) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const todaySchedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        scheduled_date: today,
      },
    });

    let taken = 0;
    let missed = 0;
    let pending = 0;
    let skipped = 0;

    for (const schedule of todaySchedules) {
      switch (schedule.status) {
        case IntakeStatus.TAKEN:
          taken++;
          break;
        case IntakeStatus.MISSED:
          missed++;
          break;
        case IntakeStatus.SKIPPED:
          skipped++;
          break;
        case IntakeStatus.PENDING:
          // Check if the time has passed
          if (schedule.scheduled_time < currentTime) {
            missed++;
            // Auto-mark as missed
            schedule.status = IntakeStatus.MISSED;
            await this.scheduleRepository.save(schedule);
          } else {
            pending++;
          }
          break;
      }
    }

    return {
      date: today,
      medications_taken_today: taken,
      medications_missed: missed,
      medications_pending: pending,
      medications_skipped: skipped,
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

    schedule.status = dto.status;

    if (dto.status === IntakeStatus.TAKEN) {
      schedule.taken_at = new Date();
    }

    if (dto.notes) {
      schedule.notes = dto.notes;
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
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate = weekAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const schedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        scheduled_date: Between(startDate, endDate),
      },
    });

    const total = schedules.length;
    const taken = schedules.filter(
      (s) => s.status === IntakeStatus.TAKEN,
    ).length;
    const missed = schedules.filter(
      (s) => s.status === IntakeStatus.MISSED,
    ).length;
    const skipped = schedules.filter(
      (s) => s.status === IntakeStatus.SKIPPED,
    ).length;

    return {
      period: { start: startDate, end: endDate },
      total_scheduled: total,
      taken,
      missed,
      skipped,
      adherence_rate: total > 0 ? Math.round((taken / total) * 100) : 0,
    };
  }
}
