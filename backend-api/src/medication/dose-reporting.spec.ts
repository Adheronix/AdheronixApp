import { Repository } from 'typeorm';
import { validate } from 'class-validator';
import { MedicationScheduleService } from './medication-schedule.service';
import { IntakeStatus, MedicationSchedule } from './medication-schedule.entity';
import { MedicationInfo } from './medication.entity';
import { Patient } from '../patient/patient.entity';
import { NotificationService } from '../notification/notification.service';
import { IntakeNoteDto, UpdateIntakeDto } from './dto/update-intake.dto';

describe('Patient dose reports', () => {
  const repository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const service = new MedicationScheduleService(
    repository as unknown as Repository<MedicationSchedule>,
    {} as Repository<MedicationInfo>,
    {} as Repository<Patient>,
    {} as NotificationService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 18, 12, 0));
    repository.save.mockImplementation((value: MedicationSchedule) =>
      Promise.resolve(value),
    );
  });
  afterEach(() => jest.useRealTimers());

  it('persists an optional skipped reason and scopes the update to its owner', async () => {
    repository.findOne.mockResolvedValue({ status: IntakeStatus.PENDING });
    const result = await service.updateIntakeStatus('patient-a', 'dose-a', {
      status: IntakeStatus.SKIPPED,
      notes: 'Reason: Cost or access\nDiscuss at next appointment',
    });
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schedule_id: 'dose-a', patient: { patient_id: 'patient-a' } },
      }),
    );
    expect(result).toMatchObject({
      status: 'skipped',
      confirmation_source: 'patient',
      taken_at: null,
      notes: 'Reason: Cost or access\nDiscuss at next appointment',
    });
  });

  it('rejects updates to a schedule not owned by this patient', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(
      service.updateIntakeStatus('patient-b', 'dose-a', {
        status: IntakeStatus.SKIPPED,
      }),
    ).rejects.toThrow('not found');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows an empty note and clears the old skipped reason when correcting to taken', async () => {
    repository.findOne.mockResolvedValue({
      status: IntakeStatus.SKIPPED,
      notes: 'Reason: Ran out',
    });
    expect(await service.markAsTaken('patient-a', 'dose-a')).toMatchObject({
      status: 'taken',
      confirmation_source: 'patient',
      notes: '',
    });
    repository.findOne.mockResolvedValue({
      status: IntakeStatus.SKIPPED,
      notes: 'Reason: Forgot',
    });
    expect(
      await service.updateIntakeStatus('patient-a', 'dose-a', {
        status: IntakeStatus.SKIPPED,
        notes: '',
      }),
    ).toMatchObject({ notes: '' });
  });

  it('preserves an existing note if the same status is retried without notes', async () => {
    repository.findOne.mockResolvedValue({
      status: IntakeStatus.SKIPPED,
      notes: 'Reason: Forgot',
    });
    expect(
      await service.updateIntakeStatus('patient-a', 'dose-a', {
        status: IntakeStatus.SKIPPED,
      }),
    ).toMatchObject({ notes: 'Reason: Forgot' });
  });

  it('corrects a taken report to unknown without retaining a taken time or source', async () => {
    repository.findOne.mockResolvedValue({
      status: IntakeStatus.TAKEN,
      taken_at: new Date(),
      confirmation_source: 'patient',
      notes: 'Old note',
    });
    expect(
      await service.updateIntakeStatus('patient-a', 'dose-a', {
        status: IntakeStatus.PENDING,
        notes: 'Unsure whether this dose was taken.',
      }),
    ).toMatchObject({
      status: 'pending',
      taken_at: null,
      confirmation_source: null,
    });
  });

  it('keeps unknown entries in the weekly denominator and excludes upcoming entries', async () => {
    const dose = (
      status: IntakeStatus,
      confirmation_source: 'patient' | null,
      scheduled_time = '09:00:00',
    ) => ({
      status,
      confirmation_source,
      scheduled_time,
      scheduled_date: '2026-11-18',
    });
    repository.find.mockResolvedValue([
      dose(IntakeStatus.TAKEN, 'patient'),
      dose(IntakeStatus.TAKEN, null),
      dose(IntakeStatus.SKIPPED, 'patient'),
      dose(IntakeStatus.PENDING, null),
      dose(IntakeStatus.PENDING, null, '23:00:00'),
    ]);
    expect(await service.getWeeklyAdherence('patient-a')).toMatchObject({
      total_scheduled: 4,
      taken: 2,
      patient_reported_taken: 1,
      unattributed_taken: 1,
      unreported: 1,
      skipped: 1,
      upcoming: 1,
      adherence_rate: 25,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each([IntakeNoteDto, UpdateIntakeDto])(
    'bounds personal notes for both intake routes (%p)',
    async (Dto) => {
      const dto = Object.assign(new Dto(), {
        status: IntakeStatus.SKIPPED,
        notes: 'x'.repeat(2001),
      });
      expect(
        (await validate(dto)).some((error) => error.property === 'notes'),
      ).toBe(true);
    },
  );
});
