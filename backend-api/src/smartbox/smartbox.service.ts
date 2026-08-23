import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HealthScoreService } from '../health-score/health-score.service';
import { MedicationInfo } from '../medication/medication.entity';
import {
  IntakeStatus,
  MedicationSchedule,
} from '../medication/medication-schedule.entity';
import { NotificationType } from '../notification/notification.entity';
import { NotificationService } from '../notification/notification.service';
import { Patient } from '../patient/patient.entity';
import { DoseEventDto } from './dto/dose-event.dto';
import { SmartboxDoseEvent } from './smartbox-dose-event.entity';

@Injectable()
export class SmartboxService {
  private readonly logger = new Logger(SmartboxService.name);

  constructor(
    @InjectRepository(SmartboxDoseEvent)
    private readonly eventRepository: Repository<SmartboxDoseEvent>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(MedicationInfo)
    private readonly medicationRepository: Repository<MedicationInfo>,
    @InjectRepository(MedicationSchedule)
    private readonly scheduleRepository: Repository<MedicationSchedule>,
    private readonly configService: ConfigService,
    private readonly healthScoreService: HealthScoreService,
    private readonly notificationService: NotificationService,
  ) {}

  validateDeviceToken(authorization?: string) {
    const expected = this.configService.get<string>('SMARTBOX_API_KEY');
    if (!expected) {
      return;
    }

    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (token !== expected) {
      throw new UnauthorizedException('Invalid smartbox device token');
    }
  }

  async recordDoseEvent(dto: DoseEventDto): Promise<{
    status: string;
    received: boolean;
    event: Record<string, unknown>;
    scoreUpdated: boolean;
  }> {
    const patient = await this.resolvePatient(dto.deviceId, dto.patientId);
    const timestamp = this.resolveTimestamp(dto.timestamp);

    const event = this.eventRepository.create({
      device_id: dto.deviceId,
      bin_index: dto.binIndex,
      dose_timestamp: timestamp,
      confirmed: dto.confirmed,
      weight_before: dto.weightBefore ?? null,
      weight_after: dto.weightAfter ?? null,
      weight_left_g: dto.weightLeftG,
      score_impact: dto.scoreImpact ?? (dto.confirmed ? 15 : 0),
      raw_payload: dto as unknown as Record<string, unknown>,
      patient,
    });

    const saved = await this.eventRepository.save(event);
    const scoreUpdated = await this.applyDoseSideEffects(saved);

    this.logger.log(
      `Smartbox event ${saved.event_id}: device=${saved.device_id}, bin=${saved.bin_index}, confirmed=${saved.confirmed}, patient=${patient?.patient_id ?? 'unmapped'}`,
    );

    return {
      status: saved.confirmed ? 'verified' : 'unconfirmed',
      received: true,
      event: this.toClientEvent(saved),
      scoreUpdated,
    };
  }

  async recordDemoDose(patientId: string) {
    const schedule = await this.findBestDoseSchedule(patientId);
    const medication =
      schedule?.medication ??
      (await this.findLatestMedicationForPatient(patientId));

    if (!medication) {
      return this.recordDoseEvent({
        deviceId: 'SMARTBOX-0001',
        binIndex: 0,
        medicine: 'No medication',
        dosage: '',
        condition: 'Scan barcode',
        scheduledTime: '--:--',
        timestamp: new Date().toISOString(),
        confirmed: true,
        verified: true,
        weightBefore: 0,
        weightAfter: 0,
        weightLeftG: 0,
        pillsRemaining: 0,
        scoreImpact: 15,
        patientId,
      });
    }

    const parsed = this.extractMedicationDisplay(medication);
    const pillsBefore = Math.max(0, Math.round(parsed.pillsRemaining));
    const pillsRemaining = Math.max(0, pillsBefore - 1);
    const weightBefore = pillsBefore * parsed.pillWeightG;
    const weightAfter = pillsRemaining * parsed.pillWeightG;
    const scheduledTime =
      schedule?.scheduled_time?.slice(0, 5) ??
      this.extractFirstString(medication.prescription, [
        'scheduledTime',
        'scheduled_time',
        'time',
      ]) ??
      '--:--';

    return this.recordDoseEvent({
      deviceId: 'SMARTBOX-0001',
      binIndex: 0,
      medicine: parsed.name,
      dosage: parsed.dosage,
      condition: parsed.condition,
      scheduledTime,
      timestamp: new Date().toISOString(),
      confirmed: true,
      verified: true,
      weightBefore,
      weightAfter,
      weightLeftG: weightAfter,
      pillsRemaining,
      scoreImpact: 15,
      patientId,
    });
  }

  async getLatestForPatient(patientId?: string) {
    const event =
      (patientId
        ? await this.eventRepository.findOne({
            where: { patient: { patient_id: patientId } },
            relations: ['patient'],
            order: { received_at: 'DESC' },
          })
        : null) ??
      (await this.eventRepository.findOne({
        relations: ['patient'],
        order: { received_at: 'DESC' },
      }));

    if (!event) {
      return {
        status: 'waiting',
        message: 'No smartbox doses recorded yet',
      };
    }

    return this.toClientEvent(event);
  }

  async getDeviceSchedule(deviceId: string): Promise<string> {
    const patient = await this.resolvePatient(deviceId);
    if (!patient) {
      return this.scheduleText({
        medicine: 'No patient',
        dosage: '',
        condition: 'Device unmapped',
        scheduledTime: '--:--',
        pillsRemaining: 0,
        totalPills: 0,
        pillWeightG: 5,
      });
    }

    const schedule =
      (await this.findDisplaySchedule(patient.patient_id)) ??
      (await this.findLatestScheduleForPatient(patient.patient_id));

    const medication =
      schedule?.medication ??
      (await this.findLatestMedicationForPatient(patient.patient_id));

    if (!medication) {
      return this.scheduleText({
        medicine: 'No medication',
        dosage: '',
        condition: 'Scan barcode',
        scheduledTime: '--:--',
        pillsRemaining: 0,
        totalPills: 0,
        pillWeightG: 5,
      });
    }

    const parsed = this.extractMedicationDisplay(medication);
    const scheduledTime =
      schedule?.scheduled_time?.slice(0, 5) ??
      this.extractFirstString(medication.prescription, [
        'scheduledTime',
        'scheduled_time',
        'time',
      ]) ??
      '08:30';

    return this.scheduleText({
      medicine: parsed.name,
      dosage: parsed.dosage,
      condition: parsed.condition,
      scheduledTime,
      pillsRemaining: parsed.pillsRemaining,
      totalPills: parsed.totalPills,
      pillWeightG: parsed.pillWeightG,
    });
  }

  private async resolvePatient(
    deviceId: string,
    patientId?: string,
  ): Promise<Patient | null> {
    const resolvedPatientId =
      patientId ??
      this.patientIdFromDeviceMap(deviceId) ??
      this.configService.get<string>('SMARTBOX_DEMO_PATIENT_ID');

    if (!resolvedPatientId) {
      return null;
    }

    return this.patientRepository.findOne({
      where: { patient_id: resolvedPatientId },
    });
  }

  private async findDisplaySchedule(patientId: string) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const pendingSchedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        status: IntakeStatus.PENDING,
      },
      relations: ['medication'],
      order: { scheduled_date: 'ASC', scheduled_time: 'ASC' },
      take: 50,
    });

    return (
      pendingSchedules.find(
        (candidate) =>
          candidate.scheduled_date > today ||
          (candidate.scheduled_date === today &&
            candidate.scheduled_time.slice(0, 5) >= currentTime),
      ) ??
      pendingSchedules.find((candidate) => candidate.scheduled_date === today) ??
      pendingSchedules[0]
    );
  }

  private async findBestDoseSchedule(patientId: string) {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: patientId },
        status: In([IntakeStatus.PENDING, IntakeStatus.MISSED]),
      },
      relations: ['medication'],
      order: { scheduled_date: 'ASC', scheduled_time: 'ASC' },
      take: 50,
    });

    return (
      schedules.find((candidate) => candidate.scheduled_date === today) ??
      schedules[0]
    );
  }

  private findLatestScheduleForPatient(patientId: string) {
    return this.scheduleRepository.findOne({
      where: {
        patient: { patient_id: patientId },
      },
      relations: ['medication'],
      order: { scheduled_date: 'DESC', scheduled_time: 'DESC' },
    });
  }

  private findLatestMedicationForPatient(patientId: string) {
    return this.medicationRepository.findOne({
      where: { patient: { patient_id: patientId } },
      order: { updated_at: 'DESC' },
    });
  }

  private patientIdFromDeviceMap(deviceId: string): string | undefined {
    const rawMap = this.configService.get<string>('SMARTBOX_DEVICE_PATIENT_MAP');
    if (!rawMap) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(rawMap) as Record<string, string>;
      return parsed[deviceId];
    } catch {
      const directMatch = rawMap
        .split(',')
        .map((entry) => entry.trim())
        .map((entry) => entry.split(':'))
        .find(([mappedDevice]) => mappedDevice === deviceId);

      if (directMatch?.[1]) {
        return directMatch.slice(1).join(':').trim();
      }

      this.logger.warn(
        'SMARTBOX_DEVICE_PATIENT_MAP is not valid JSON or device:patient mapping',
      );
      return undefined;
    }
  }

  private extractMedicationDisplay(medication: MedicationInfo) {
    const prescription = medication.prescription;
    const name =
      this.extractFirstString(prescription, ['name', 'medicine', 'medication']) ??
      'Medication';
    const dosage =
      this.extractFirstString(prescription, [
        'dose',
        'dosage',
        'strength',
        'amount',
      ]) ?? '';
    const condition =
      this.extractFirstString(prescription, [
        'condition',
        'diagnosis',
        'reason',
      ]) ??
      medication.intake_recommendation ??
      'As prescribed';

    const totalPills =
      this.extractFirstNumber(prescription, [
        'totalPills',
        'pills',
        'quantity',
        'count',
      ]) ?? 10;
    const pillsRemaining =
      this.extractFirstNumber(prescription, [
        'pillsRemaining',
        'remaining',
        'quantity',
        'count',
      ]) ?? totalPills;
    const pillWeightG =
      this.extractFirstNumber(prescription, ['pillWeightG', 'pill_weight_g']) ??
      5;

    return {
      name,
      dosage,
      condition,
      totalPills,
      pillsRemaining,
      pillWeightG,
    };
  }

  private extractFirstString(
    value: unknown,
    keys: string[],
  ): string | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    const nested = Object.values(record).flatMap((candidate) =>
      Array.isArray(candidate) ? candidate : [candidate],
    );

    for (const candidate of nested) {
      const found = this.extractFirstString(candidate, keys);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  private extractFirstNumber(
    value: unknown,
    keys: string[],
  ): number | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string') {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    const nested = Object.values(record).flatMap((candidate) =>
      Array.isArray(candidate) ? candidate : [candidate],
    );

    for (const candidate of nested) {
      const found = this.extractFirstNumber(candidate, keys);
      if (typeof found === 'number') {
        return found;
      }
    }

    return undefined;
  }

  private scheduleText(data: {
    medicine: string;
    dosage: string;
    condition: string;
    scheduledTime: string;
    pillsRemaining: number;
    totalPills: number;
    pillWeightG: number;
  }) {
    return [
      `medicine=${this.cleanScheduleValue(data.medicine)}`,
      `dosage=${this.cleanScheduleValue(data.dosage)}`,
      `condition=${this.cleanScheduleValue(data.condition)}`,
      `scheduledTime=${this.cleanScheduleValue(data.scheduledTime)}`,
      `pillsRemaining=${Math.max(0, Math.round(data.pillsRemaining))}`,
      `totalPills=${Math.max(0, Math.round(data.totalPills))}`,
      `pillWeightG=${Math.max(0.1, data.pillWeightG).toFixed(1)}`,
    ].join('\n');
  }

  private cleanScheduleValue(value: string) {
    return value.replace(/[\r\n=]/g, ' ').trim().slice(0, 48);
  }

  private resolveTimestamp(timestamp?: string): Date {
    if (!timestamp) {
      return new Date();
    }

    const numeric = Number(timestamp);
    if (Number.isFinite(numeric) && numeric > 0) {
      if (numeric < 1000000000) {
        return new Date();
      }
      return new Date(numeric < 10000000000 ? numeric * 1000 : numeric);
    }

    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private async applyDoseSideEffects(event: SmartboxDoseEvent) {
    if (!event.patient) {
      return false;
    }

    try {
      await this.notificationService.create(event.patient.patient_id, {
        title: event.confirmed
          ? 'Smart Box dose verified'
          : 'Smart Box dose unconfirmed',
        message: event.confirmed
          ? `Bin ${event.bin_index + 1} dose was verified by the smart medbox.`
          : `Bin ${event.bin_index + 1} changed, but the patient did not confirm in time.`,
        type: event.confirmed
          ? NotificationType.MEDICATION_UPDATE
          : NotificationType.SYSTEM_ALERT,
        metadata: {
          source: 'smartbox',
          device_id: event.device_id,
          event_id: event.event_id,
          weight_left_g: event.weight_left_g,
        },
      });

      if (event.confirmed) {
        await this.markMatchingScheduleTaken(event);
        await this.healthScoreService.onDoseTaken(
          event.patient.patient_id,
          100,
          true,
        );
      } else {
        await this.healthScoreService.onDoseMissed(
          event.patient.patient_id,
          0,
          false,
          1,
        );
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Smartbox side effects failed for event ${event.event_id}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async markMatchingScheduleTaken(event: SmartboxDoseEvent) {
    if (!event.patient) {
      return;
    }

    let schedule = await this.findScheduleForEvent(event);
    if (!schedule) {
      schedule = await this.createScheduleFromEvent(event);
    }

    if (!schedule) {
      this.logger.warn(
        `No matching schedule found for smartbox event ${event.event_id}`,
      );
      return;
    }

    schedule.status = IntakeStatus.TAKEN;
    schedule.taken_at = event.dose_timestamp;
    schedule.notes = `Verified by Smart Box ${event.device_id}, bin ${event.bin_index + 1}`;
    await this.scheduleRepository.save(schedule);

    const remaining =
      typeof event.raw_payload?.pillsRemaining === 'number'
        ? event.raw_payload.pillsRemaining
        : undefined;
    if (typeof remaining === 'number') {
      await this.updateMedicationPillCount(schedule.medication, remaining);
    }
  }

  private async findScheduleForEvent(event: SmartboxDoseEvent) {
    if (!event.patient) {
      return undefined;
    }

    const today = event.dose_timestamp.toISOString().split('T')[0];
    const schedules = await this.scheduleRepository.find({
      where: {
        patient: { patient_id: event.patient.patient_id },
        status: In([IntakeStatus.PENDING, IntakeStatus.MISSED]),
      },
      relations: ['medication'],
      order: { scheduled_date: 'ASC', scheduled_time: 'ASC' },
      take: 50,
    });

    const eventMedicine =
      typeof event.raw_payload?.medicine === 'string'
        ? this.normalizeText(event.raw_payload.medicine)
        : undefined;
    const eventTime =
      typeof event.raw_payload?.scheduledTime === 'string'
        ? this.normalizeScheduleTime(event.raw_payload.scheduledTime)
        : undefined;

    const matchesMedicine = (schedule: MedicationSchedule) => {
      if (!eventMedicine) {
        return true;
      }
      const parsed = this.extractMedicationDisplay(schedule.medication);
      return this.normalizeText(parsed.name) === eventMedicine;
    };

    return (
      schedules.find(
        (schedule) =>
          schedule.scheduled_date === today &&
          (!eventTime ||
            this.normalizeScheduleTime(schedule.scheduled_time) === eventTime) &&
          matchesMedicine(schedule),
      ) ??
      schedules.find(
        (schedule) => schedule.scheduled_date === today && matchesMedicine(schedule),
      ) ??
      schedules.find(matchesMedicine) ??
      schedules[0]
    );
  }

  private async createScheduleFromEvent(event: SmartboxDoseEvent) {
    if (!event.patient) {
      return undefined;
    }

    const medicineName =
      typeof event.raw_payload?.medicine === 'string'
        ? event.raw_payload.medicine.trim()
        : '';
    if (
      !medicineName ||
      medicineName.toLowerCase() === 'no medication' ||
      medicineName.toLowerCase() === 'syncing'
    ) {
      return undefined;
    }

    const normalizedEventName = this.normalizeText(medicineName);
    const patientMedications = await this.medicationRepository.find({
      where: { patient: { patient_id: event.patient.patient_id } },
      order: { updated_at: 'DESC' },
    });

    let medication = patientMedications.find((med) => {
      const parsed = this.extractMedicationDisplay(med);
      return this.normalizeText(parsed.name) === normalizedEventName;
    });

    const pillsRemaining =
      typeof event.raw_payload?.pillsRemaining === 'number'
        ? event.raw_payload.pillsRemaining
        : 0;
    const weightLeftG =
      typeof event.raw_payload?.weightLeftG === 'number'
        ? event.raw_payload.weightLeftG
        : 0;
    const dosage =
      typeof event.raw_payload?.dosage === 'string'
        ? event.raw_payload.dosage
        : '';
    const condition =
      typeof event.raw_payload?.condition === 'string'
        ? event.raw_payload.condition
        : '';

    if (!medication) {
      const totalPills = pillsRemaining > 0 ? pillsRemaining : 1;
      const pillWeightG =
        pillsRemaining > 0 && weightLeftG > 0
          ? weightLeftG / pillsRemaining
          : 5;

      medication = this.medicationRepository.create({
        patient: event.patient,
        prescription: {
          name: medicineName,
          dose: dosage,
          condition,
          pillsRemaining: Math.max(0, Math.round(pillsRemaining)),
          totalPills: Math.max(0, Math.round(totalPills)),
          pillWeightG,
        },
        intake_recommendation: 'As prescribed',
        period: '30 days',
        source: 'smartbox',
        frequency: 1,
      });
      medication = await this.medicationRepository.save(medication);
    }

    const today = event.dose_timestamp.toISOString().split('T')[0];
    const scheduledTime =
      typeof event.raw_payload?.scheduledTime === 'string' &&
      event.raw_payload.scheduledTime.match(/\d{1,2}:\d{2}/)
        ? this.normalizeScheduleTime(event.raw_payload.scheduledTime)
        : `${event.dose_timestamp.getHours().toString().padStart(2, '0')}:${event.dose_timestamp.getMinutes().toString().padStart(2, '0')}`;

    const existing = await this.scheduleRepository.findOne({
      where: {
        medication: { medication_id: medication.medication_id },
        scheduled_date: today,
        scheduled_time: scheduledTime,
      },
    });

    if (existing) {
      existing.medication = medication;
      return existing;
    }

    const schedule = this.scheduleRepository.create({
      patient: event.patient,
      medication,
      scheduled_date: today,
      scheduled_time: scheduledTime,
      status: IntakeStatus.PENDING,
    });

    return this.scheduleRepository.save(schedule);
  }

  private async updateMedicationPillCount(
    medication: MedicationInfo | undefined,
    pillsRemaining: number,
  ) {
    if (!medication) {
      return;
    }

    medication.prescription = {
      ...(medication.prescription ?? {}),
      pillsRemaining: Math.max(0, Math.round(pillsRemaining)),
    };
    await this.medicationRepository.save(medication);
  }

  private normalizeText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private normalizeScheduleTime(value: string) {
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      return value.trim();
    }
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  private toClientEvent(event: SmartboxDoseEvent) {
    return {
      status: event.confirmed ? 'verified' : 'unconfirmed',
      eventId: event.event_id,
      deviceId: event.device_id,
      binIndex: event.bin_index,
      timestamp: event.dose_timestamp.toISOString(),
      confirmed: event.confirmed,
      verified: event.confirmed,
      weightBefore: event.weight_before,
      weightAfter: event.weight_after,
      weightLeftG: event.weight_left_g,
      scoreImpact: event.score_impact,
      medicine:
        typeof event.raw_payload?.medicine === 'string'
          ? event.raw_payload.medicine
          : undefined,
      dosage:
        typeof event.raw_payload?.dosage === 'string'
          ? event.raw_payload.dosage
          : undefined,
      condition:
        typeof event.raw_payload?.condition === 'string'
          ? event.raw_payload.condition
          : undefined,
      scheduledTime:
        typeof event.raw_payload?.scheduledTime === 'string'
          ? event.raw_payload.scheduledTime
          : undefined,
      pillsRemaining:
        typeof event.raw_payload?.pillsRemaining === 'number'
          ? event.raw_payload.pillsRemaining
          : undefined,
      receivedAt: event.received_at.toISOString(),
    };
  }
}
