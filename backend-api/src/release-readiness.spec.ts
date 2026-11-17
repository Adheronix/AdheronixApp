import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SmartboxService } from './smartbox/smartbox.service';
import { SmartboxDoseEvent } from './smartbox/smartbox-dose-event.entity';
import { SmartboxWeightReport } from './smartbox/smartbox-weight-report.entity';
import { PatientService } from './patient/patient.service';
import { Patient } from './patient/patient.entity';
import { MedicationInfo } from './medication/medication.entity';
import {
  MedicationSchedule,
  IntakeStatus,
} from './medication/medication-schedule.entity';
import { HealthScoreService } from './health-score/health-score.service';
import { NotificationService } from './notification/notification.service';
import { MedicationScheduleService } from './medication/medication-schedule.service';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';

describe('Release readiness regressions', () => {
  const configValues: Record<string, string | undefined> = {};
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const eventRepository = { findOne: jest.fn() };
  const weightRepository = { findOne: jest.fn() };
  const patientRepository = { findOne: jest.fn(), save: jest.fn() };
  const scheduleRepository = { find: jest.fn(), save: jest.fn() };
  const notifications = { create: jest.fn() };
  let smartbox: SmartboxService;

  afterEach(() => jest.useRealTimers());

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(configValues)) delete configValues[key];
    smartbox = new SmartboxService(
      eventRepository as unknown as Repository<SmartboxDoseEvent>,
      weightRepository as unknown as Repository<SmartboxWeightReport>,
      patientRepository as unknown as Repository<Patient>,
      {} as Repository<MedicationInfo>,
      scheduleRepository as unknown as Repository<MedicationSchedule>,
      config,
      {} as HealthScoreService,
      notifications as unknown as NotificationService,
    );
  });

  it('does not query another patient when the signed-in patient has no device events', async () => {
    eventRepository.findOne.mockResolvedValue(null);
    await expect(
      smartbox.getLatestForPatient('patient-a'),
    ).resolves.toMatchObject({ status: 'waiting' });
    expect(eventRepository.findOne).toHaveBeenCalledTimes(1);
    expect(eventRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patient: { patient_id: 'patient-a' } },
      }),
    );
  });

  it('rejects an event read with no patient identity before querying the database', async () => {
    await expect(smartbox.getLatestForPatient()).rejects.toThrow();
    expect(eventRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects device requests when SMARTBOX_API_KEY is absent', () => {
    expect(() => smartbox.validateDeviceToken('Bearer arbitrary')).toThrow();
  });

  it('requires a bearer scheme rather than accepting the raw device key', () => {
    configValues.SMARTBOX_API_KEY = 'audit-device-key';
    expect(() => smartbox.validateDeviceToken('audit-device-key')).toThrow();
    expect(() =>
      smartbox.validateDeviceToken('Bearer audit-device-key'),
    ).not.toThrow();
  });

  it('does not expose a password hash in push-token update responses', async () => {
    const patient = {
      patient_id: 'patient-a',
      password_hash: 'synthetic-hash',
    };
    patientRepository.findOne.mockResolvedValue(patient);
    patientRepository.save.mockImplementation((value: Patient) =>
      Promise.resolve(value),
    );
    const service = new PatientService(
      patientRepository as unknown as Repository<Patient>,
      {} as JwtService,
      config,
    );
    const result = await service.updatePushToken(
      'patient-a',
      'synthetic-push-token',
    );
    expect(result).not.toHaveProperty('password_hash');
    expect(result).toHaveProperty('patient_id', 'patient-a');
  });

  it('does not boot JWT verification with a known fallback secret', () => {
    expect(
      () =>
        new JwtStrategy(
          config,
          patientRepository as unknown as Repository<Patient>,
        ),
    ).toThrow();
  });

  it('blocks demo doses even when enabled in a production environment', async () => {
    configValues.NODE_ENV = 'production';
    configValues.SMARTBOX_DEMO_ENABLED = 'true';
    await expect(smartbox.recordDemoDose('patient-a')).rejects.toThrow(
      'disabled',
    );
    expect(scheduleRepository.find).not.toHaveBeenCalled();
  });

  it('scopes weight readings to the signed-in patient as well as the device', async () => {
    weightRepository.findOne.mockResolvedValue(null);
    await expect(
      smartbox.getLatestWeight('device-a', 'patient-a'),
    ).resolves.toMatchObject({ status: 'waiting' });
    expect(weightRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { device_id: 'device-a', patient: { patient_id: 'patient-a' } },
      }),
    );
  });

  it('rejects a device payload that overrides its assigned patient', async () => {
    configValues.NODE_ENV = 'development';
    configValues.SMARTBOX_DEMO_ENABLED = 'true';
    configValues.SMARTBOX_DEVICE_PATIENT_MAP = JSON.stringify({
      'device-a': 'patient-a',
    });
    await expect(
      smartbox.recordDoseEvent({
        deviceId: 'device-a',
        patientId: 'patient-b',
        binIndex: 0,
        confirmed: true,
        weightLeftG: 1,
      }),
    ).rejects.toThrow('not assigned');
    expect(patientRepository.findOne).not.toHaveBeenCalled();
  });

  it('reading today does not mutate dose truth or send missed-dose alerts', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    const patient = { patient_id: 'patient-a' };
    const medication = {
      medication_id: 'medication-a',
      prescription: { name: 'Example medicine' },
    };
    const schedule = {
      schedule_id: 'schedule-a',
      scheduled_date: new Date().toISOString().slice(0, 10),
      scheduled_time: '00:00:00',
      status: IntakeStatus.PENDING,
      medication,
    };
    scheduleRepository.find.mockResolvedValue([schedule]);
    scheduleRepository.save.mockResolvedValue(schedule);
    const service = new MedicationScheduleService(
      scheduleRepository as unknown as Repository<MedicationSchedule>,
      {} as Repository<MedicationInfo>,
      patientRepository as unknown as Repository<Patient>,
      notifications as unknown as NotificationService,
    );
    await service.getGeneralStatus(patient.patient_id);
    const [options] = scheduleRepository.find.mock.calls[0] as [
      { relations: string[] },
    ];
    expect(options.relations).toEqual(['medication']);
    expect(scheduleRepository.save).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(schedule.status).toBe(IntakeStatus.PENDING);
  });
});
