import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
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
import { WeightReportDto } from './dto/weight-report.dto';
import { SmartboxDoseEvent } from './smartbox-dose-event.entity';
import { SmartboxWeightReport } from './smartbox-weight-report.entity';

@Injectable()
export class SmartboxService {
  private readonly logger = new Logger(SmartboxService.name);

  constructor(
    @InjectRepository(SmartboxDoseEvent)
    private readonly eventRepository: Repository<SmartboxDoseEvent>,
    @InjectRepository(SmartboxWeightReport)
    private readonly weightRepository: Repository<SmartboxWeightReport>,
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
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!expected || !token) {
      throw new UnauthorizedException(
        'Smartbox device authentication required',
      );
    }
    const received = Buffer.from(token);
    const configured = Buffer.from(expected);
    if (
      received.length !== configured.length ||
      !timingSafeEqual(received, configured)
    ) {
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
      score_impact: 0,
      raw_payload: dto as unknown as Record<string, unknown>,
      patient,
    });

    const saved = await this.eventRepository.save(event);
    const scoreUpdated = await this.applyDoseSideEffects(saved);

    this.logger.log(
      `Smartbox event ${saved.event_id}: device=${saved.device_id}, bin=${saved.bin_index}, confirmed=${saved.confirmed}, patient=${patient?.patient_id ?? 'unmapped'}`,
    );

    return {
      status: saved.confirmed ? 'removal_detected' : 'uncertain',
      received: true,
      event: this.toClientEvent(saved),
      scoreUpdated,
    };
  }

  async recordDemoDose(patientId: string) {
    if (
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<string>('SMARTBOX_DEMO_ENABLED') !== 'true'
    ) {
      throw new ForbiddenException('Smartbox demo doses are disabled');
    }
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
    if (!patientId) {
      throw new UnauthorizedException('Patient identity required');
    }
    const event = await this.eventRepository.findOne({
      where: { patient: { patient_id: patientId } },
      relations: ['patient'],
      order: { received_at: 'DESC' },
    });

    if (!event) {
      return {
        status: 'waiting',
        message: 'No smartbox doses recorded yet',
      };
    }

    return this.toClientEvent(event);
  }

  async recordWeightReport(dto: WeightReportDto): Promise<{
    status: string;
    received: boolean;
    reportId?: string;
    patientId?: string;
  }> {
    const patient = await this.resolvePatient(dto.deviceId);

    const report = this.weightRepository.create({
      device_id: dto.deviceId,
      weight_g: dto.weightG,
      pills_est: dto.pillsEst ?? null,
      source: dto.source ?? 'loadcell',
      patient,
    });
    const saved = await this.weightRepository.save(report);

    return {
      status: 'ok',
      received: true,
      reportId: saved.report_id,
      patientId: patient?.patient_id,
    };
  }

  async getLatestWeight(deviceId: string, patientId: string) {
    if (!patientId) {
      throw new UnauthorizedException('Patient identity required');
    }
    const report = await this.weightRepository.findOne({
      where: { device_id: deviceId, patient: { patient_id: patientId } },
      order: { reported_at: 'DESC' },
    });

    if (!report) {
      return {
        status: 'waiting',
        message: `No weight reports from ${deviceId} yet`,
      };
    }

    return {
      status: 'ok',
      deviceId: report.device_id,
      weightG: report.weight_g,
      pillsEst: report.pills_est,
      source: report.source,
      reportedAt: report.reported_at.toISOString(),
      patientId: report.patient?.patient_id,
    };
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

    const doseTakenToday =
      (await this.countTakenToday(
        patient.patient_id,
        medication.medication_id,
      )) > 0;

    return this.scheduleText({
      medicine: parsed.name,
      dosage: parsed.dosage,
      condition: parsed.condition,
      scheduledTime,
      scheduledDate: schedule?.scheduled_date,
      pillsRemaining: parsed.pillsRemaining,
      totalPills: parsed.totalPills,
      pillWeightG: parsed.pillWeightG,
      doseTakenToday,
    });
  }

  private async countTakenToday(patientId: string, medicationId?: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.scheduleRepository.count({
      where: {
        patient: { patient_id: patientId },
        status: IntakeStatus.TAKEN,
        scheduled_date: today,
        ...(medicationId
          ? { medication: { medication_id: medicationId } }
          : {}),
      },
    });
  }

  private async resolvePatient(
    deviceId: string,
    patientId?: string,
  ): Promise<Patient | null> {
    const demoEnabled =
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      this.configService.get<string>('SMARTBOX_DEMO_ENABLED') === 'true';
    const mappedPatientId = this.patientIdFromDeviceMap(deviceId);
    if (
      patientId &&
      patientId !== mappedPatientId &&
      (!demoEnabled || mappedPatientId !== undefined)
    ) {
      throw new ForbiddenException('Device is not assigned to this patient');
    }
    const resolvedPatientId =
      mappedPatientId ??
      (demoEnabled
        ? (patientId ??
          this.configService.get<string>('SMARTBOX_DEMO_PATIENT_ID'))
        : undefined);

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
      pendingSchedules.find(
        (candidate) => candidate.scheduled_date === today,
      ) ??
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
    const rawMap = this.configService.get<string>(
      'SMARTBOX_DEVICE_PATIENT_MAP',
    );
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
      this.extractFirstString(prescription, [
        'name',
        'medicine',
        'medication',
      ]) ?? 'Medication';
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

    const nested = Object.values(record).flatMap((candidate): unknown[] =>
      Array.isArray(candidate) ? (candidate as unknown[]) : [candidate],
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

    const nested = Object.values(record).flatMap((candidate): unknown[] =>
      Array.isArray(candidate) ? (candidate as unknown[]) : [candidate],
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
    scheduledDate?: string;
    pillsRemaining: number;
    totalPills: number;
    pillWeightG: number;
    doseTakenToday?: boolean;
  }) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    return [
      `medicine=${this.cleanScheduleValue(data.medicine)}`,
      `dosage=${this.cleanScheduleValue(data.dosage)}`,
      `condition=${this.cleanScheduleValue(data.condition)}`,
      `scheduledTime=${this.cleanScheduleValue(data.scheduledTime)}`,
      `scheduledDate=${data.scheduledDate ?? today}`,
      `pillsRemaining=${Math.max(0, Math.round(data.pillsRemaining))}`,
      `totalPills=${Math.max(0, Math.round(data.totalPills))}`,
      `pillWeightG=${Math.max(0.1, data.pillWeightG).toFixed(1)}`,
      `doseTakenToday=${data.doseTakenToday ? 1 : 0}`,
      `serverDate=${today}`,
      `serverTime=${currentTime}`,
    ].join('\n');
  }

  private cleanScheduleValue(value: string) {
    return value
      .replace(/[\r\n=]/g, ' ')
      .trim()
      .slice(0, 48);
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
    if (event.patient) {
      await this.notificationService.create(event.patient.patient_id, {
        title: 'Pill box activity recorded',
        message:
          'Your pill box reported activity. Review your daily plan and confirm any dose you actually took.',
        type: NotificationType.MEDICATION_UPDATE,
        metadata: {
          source: 'device',
          device_id: event.device_id,
          event_id: event.event_id,
          requires_patient_confirmation: true,
        },
      });
    }
    // Physical removal is telemetry, not a patient confirmation or score update.
    return false;
  }

  async listDevicesForPatient(patientId: string) {
    const map =
      this.configService.get<string>('SMARTBOX_DEVICE_PATIENT_MAP') ?? '{}';
    let ids: string[];
    try {
      ids = Object.keys(JSON.parse(map) as Record<string, string>);
    } catch {
      ids = map.split(',').map((entry) => entry.split(':')[0].trim());
    }
    const ownIds = ids.filter(
      (id) => this.patientIdFromDeviceMap(id) === patientId,
    );
    return Promise.all(
      ownIds.map(async (deviceId) => ({
        deviceId,
        latestWeight: await this.getLatestWeight(deviceId, patientId),
        latestEvent: await this.eventRepository
          .findOne({
            where: { device_id: deviceId, patient: { patient_id: patientId } },
            order: { received_at: 'DESC' },
          })
          .then((event) => (event ? this.toClientEvent(event) : null)),
      })),
    );
  }

  private toClientEvent(event: SmartboxDoseEvent) {
    return {
      status: event.confirmed ? 'removal_detected' : 'uncertain',
      eventId: event.event_id,
      deviceId: event.device_id,
      binIndex: event.bin_index,
      timestamp: event.dose_timestamp.toISOString(),
      confirmed: false,
      verified: false,
      source: 'device',
      deviceConfirmed: event.confirmed,
      patientConfirmed: false,
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
