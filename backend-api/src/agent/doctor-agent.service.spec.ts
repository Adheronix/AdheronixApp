import { DoctorAgentService } from './doctor-agent.service';

describe('DoctorAgentService', () => {
  const patientService = {
    findById: jest.fn(),
  };
  const medicationService = {
    findAllForPatient: jest.fn(),
  };
  const medicationScheduleService = {
    getWeeklyAdherence: jest.fn(),
    getUpcomingMedications: jest.fn(),
    getScheduleHistory: jest.fn(),
  };
  const notificationService = {
    create: jest.fn(),
  };
  const aiClientService = {
    createPrimaryDecision: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  let service: DoctorAgentService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DoctorAgentService(
      patientService as any,
      medicationService as any,
      medicationScheduleService as any,
      notificationService as any,
      aiClientService as any,
      configService as any,
    );

    patientService.findById.mockResolvedValue({
      patient_id: 'patient-1',
      role: 'patient',
      age: 48,
      gender: 'Female',
      conditions: 'Hypertension',
      allergies: 'None',
      emergency_contact_phone: '+250000000000',
    });
    medicationService.findAllForPatient.mockResolvedValue([
      {
        medication_id: 'med-1',
        prescription: { name: 'Amlodipine' },
        frequency: 1,
        period: '30 days',
        intake_recommendation: 'Take daily',
        source: 'clinician',
      },
    ]);
    medicationScheduleService.getWeeklyAdherence.mockResolvedValue({
      total_scheduled: 7,
      taken: 3,
      missed: 4,
      skipped: 0,
      adherence_rate: 43,
    });
    medicationScheduleService.getUpcomingMedications.mockResolvedValue([]);
    medicationScheduleService.getScheduleHistory.mockResolvedValue([
      {
        schedule_id: 'schedule-1',
        medication: {
          medication_id: 'med-1',
          prescription: { name: 'Amlodipine' },
        },
        scheduled_date: '2026-05-05',
        scheduled_time: '08:00',
        status: 'missed',
        taken_at: null,
        notes: null,
      },
    ]);
    notificationService.create.mockResolvedValue({
      notification_id: 'notification-1',
    });
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        AGENT_MAX_TOOL_CALLS: '3',
        AGENT_ALLOW_EMERGENCY_WEBHOOK: 'false',
      };
      return values[key];
    });
  });

  it('executes notifyPatient tool calls through NotificationService', async () => {
    aiClientService.createPrimaryDecision.mockResolvedValue({
      model: 'test-primary',
      toolCalls: [
        {
          name: 'notifyPatient',
          arguments: {
            title: 'Medication check',
            message: 'Please review your missed medication.',
            severity: 'warning',
            rationale: 'Missed doses were detected.',
          },
        },
      ],
    });

    const result = await service.evaluatePatient('patient-1', {
      source: 'unit_test',
    });

    expect(result.status).toBe('evaluated');
    expect(notificationService.create).toHaveBeenCalledWith(
      'patient-1',
      expect.objectContaining({
        title: 'Medication check',
        message: 'Please review your missed medication.',
        metadata: expect.objectContaining({
          action: 'notifyPatient',
          severity: 'warning',
        }),
      }),
    );
  });

  it('defers emergency support calls when the emergency webhook is disabled', async () => {
    aiClientService.createPrimaryDecision.mockResolvedValue({
      model: 'test-primary',
      toolCalls: [
        {
          name: 'callEmergencySupport',
          arguments: {
            reason: 'Potential emergency risk.',
            observedRisk: 'Critical medication non-adherence.',
          },
        },
      ],
    });

    const result = await service.evaluatePatient('patient-1', {
      source: 'unit_test',
    });

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        action: 'callEmergencySupport',
        status: 'deferred',
      }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      'patient-1',
      expect.objectContaining({
        title: 'Emergency support review requested',
        metadata: expect.objectContaining({
          action: 'callEmergencySupport',
          status: 'blocked_pending_configuration',
        }),
      }),
    );
  });
});
