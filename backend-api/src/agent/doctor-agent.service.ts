import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PatientService } from '../patient/patient.service';
import { MedicationService } from '../medication/medication.service';
import { MedicationScheduleService } from '../medication/medication-schedule.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { AiClientService } from './ai-client.service';
import {
  AgentActionResult,
  AgentPatientContext,
  AgentTrigger,
  DoctorToolCall,
} from './agent.types';

@Injectable()
export class DoctorAgentService {
  private readonly logger = new Logger(DoctorAgentService.name);

  constructor(
    private readonly patientService: PatientService,
    private readonly medicationService: MedicationService,
    private readonly medicationScheduleService: MedicationScheduleService,
    private readonly notificationService: NotificationService,
    private readonly aiClientService: AiClientService,
    private readonly configService: ConfigService,
  ) {}

  async evaluatePatient(patientId: string, trigger?: AgentTrigger) {
    const context = await this.buildPatientContext(patientId, trigger);

    try {
      const decision =
        await this.aiClientService.createPrimaryDecision(context);
      const maxToolCalls = Number(
        this.configService.get<string>('AGENT_MAX_TOOL_CALLS') ?? 3,
      );
      const toolCalls = decision.toolCalls.slice(0, maxToolCalls);

      if (toolCalls.length === 0) {
        return {
          patient_id: patientId,
          status: 'no_action',
          model: decision.model,
          results: [],
        };
      }

      const results: AgentActionResult[] = [];
      for (const toolCall of toolCalls) {
        results.push(await this.executeToolCall(patientId, toolCall, context));
      }

      return {
        patient_id: patientId,
        status: 'evaluated',
        model: decision.model,
        results,
      };
    } catch (error) {
      this.logger.error(
        `Primary doctor agent failed for patient ${patientId}: ${
          (error as Error).message
        }`,
      );

      const fallback = await this.requestHumanReview(
        patientId,
        {
          priority: 'urgent',
          summary: 'Primary AI safety review failed.',
          rationale:
            'The background monitor detected a concern, but the primary model was unavailable or returned an invalid response.',
        },
        context,
      );

      return {
        patient_id: patientId,
        status: 'fallback_human_review_requested',
        results: [fallback],
      };
    }
  }

  async buildPatientContext(
    patientId: string,
    trigger?: AgentTrigger,
  ): Promise<AgentPatientContext> {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    const startDate = this.toDateOnly(start);
    const endDate = this.toDateOnly(now);

    const patient = (await this.patientService.findById(patientId)) as any;
    const [medications, weeklyAdherence, upcomingToday, scheduleHistory] =
      await Promise.all([
        this.medicationService.findAllForPatient(patientId),
        this.medicationScheduleService.getWeeklyAdherence(patientId),
        this.medicationScheduleService.getUpcomingMedications(patientId),
        this.medicationScheduleService.getScheduleHistory(
          patientId,
          startDate,
          endDate,
        ),
      ]);

    const recentScheduleHistory = scheduleHistory
      .slice(0, 100)
      .map((schedule: any) => ({
        schedule_id: schedule.schedule_id,
        medication_id: schedule.medication?.medication_id,
        medication_name: this.getMedicationName(schedule.medication),
        scheduled_date: schedule.scheduled_date,
        scheduled_time: schedule.scheduled_time,
        status: schedule.status,
        taken_at: schedule.taken_at,
        notes: schedule.notes,
      }));

    const recentMissedCount = recentScheduleHistory.filter(
      (schedule) => schedule.status === 'missed',
    ).length;
    const recentSkippedCount = recentScheduleHistory.filter(
      (schedule) => schedule.status === 'skipped',
    ).length;
    const overdueTodayCount = upcomingToday.filter(
      (item: any) => item.status === 'pending' && item.time_until === 'Overdue',
    ).length;

    return {
      generated_at: now.toISOString(),
      data_sources: {
        medication_adherence: true,
        vitals: false,
        patient_logs: false,
      },
      patient: {
        patient_id: patient.patient_id,
        role: patient.role,
        age: patient.age,
        gender: patient.gender,
        conditions: patient.conditions,
        allergies: patient.allergies,
        has_emergency_contact: Boolean(patient.emergency_contact_phone),
      },
      medication_summary: {
        active_medication_count: medications.length,
        recent_missed_count: recentMissedCount,
        recent_skipped_count: recentSkippedCount,
        overdue_today_count: overdueTodayCount,
      },
      medications: medications.map((medication: any) => ({
        medication_id: medication.medication_id,
        name: this.getMedicationName(medication),
        frequency: medication.frequency,
        period: medication.period,
        intake_recommendation: medication.intake_recommendation,
        source: medication.source,
        issued_at: medication.issued_at,
      })),
      adherence: {
        weekly: weeklyAdherence,
      },
      upcoming_today: upcomingToday,
      recent_schedule_history: recentScheduleHistory,
      trigger,
    };
  }

  private async executeToolCall(
    patientId: string,
    toolCall: DoctorToolCall,
    context: AgentPatientContext,
  ): Promise<AgentActionResult> {
    switch (toolCall.name) {
      case 'notifyPatient':
        return this.notifyPatient(patientId, toolCall.arguments, context);
      case 'alertEmergencyContact':
        return this.alertEmergencyContact(
          patientId,
          toolCall.arguments,
          context,
        );
      case 'requestHumanReview':
        return this.requestHumanReview(patientId, toolCall.arguments, context);
      case 'callEmergencySupport':
        return this.callEmergencySupport(
          patientId,
          toolCall.arguments,
          context,
        );
      default:
        this.logger.warn(
          `Skipping unknown doctor agent tool "${toolCall.name}" for patient ${patientId}`,
        );
        return {
          action: toolCall.name,
          status: 'skipped',
          detail: 'Unknown tool name returned by LLM.',
        };
    }
  }

  private async notifyPatient(
    patientId: string,
    args: Record<string, unknown>,
    context: AgentPatientContext,
  ): Promise<AgentActionResult> {
    const title = this.asString(args.title, 'Medication safety check');
    const message = this.asString(
      args.message,
      'Please review your medication plan and contact your care team if you feel unwell.',
    );
    const severity = this.asString(args.severity, 'warning');

    const notification = await this.notificationService.create(patientId, {
      title: this.truncate(title, 120),
      message: this.truncate(message, 600),
      type: NotificationType.SYSTEM_ALERT,
      metadata: {
        source: 'doctor_agent',
        action: 'notifyPatient',
        severity,
        rationale: this.asString(args.rationale),
        trigger: context.trigger,
      },
    });

    return {
      action: 'notifyPatient',
      status: 'executed',
      detail: `Notification ${notification.notification_id} created.`,
      metadata: { notification_id: notification.notification_id },
    };
  }

  private async alertEmergencyContact(
    patientId: string,
    args: Record<string, unknown>,
    context: AgentPatientContext,
  ): Promise<AgentActionResult> {
    const webhookUrl = this.configService.get<string>(
      'EMERGENCY_CONTACT_WEBHOOK_URL',
    );
    const message = this.asString(
      args.message,
      'A safety concern was detected for this patient.',
    );

    if (webhookUrl) {
      await this.postWebhook(webhookUrl, {
        patient_id: patientId,
        action: 'alertEmergencyContact',
        message,
        severity: this.asString(args.severity, 'warning'),
        rationale: this.asString(args.rationale),
        trigger: context.trigger,
      });

      return {
        action: 'alertEmergencyContact',
        status: 'executed',
        detail: 'Emergency contact webhook dispatched.',
      };
    }

    const notification = await this.notificationService.create(patientId, {
      title: 'Emergency contact review requested',
      message:
        'A safety concern was detected. Please contact your emergency contact or care team if you need immediate help.',
      type: NotificationType.SYSTEM_ALERT,
      metadata: {
        source: 'doctor_agent',
        action: 'alertEmergencyContact',
        severity: this.asString(args.severity, 'warning'),
        rationale: this.asString(args.rationale),
        original_message: message,
        trigger: context.trigger,
      },
    });

    this.logger.warn(
      `Emergency contact alert deferred for patient ${patientId}; EMERGENCY_CONTACT_WEBHOOK_URL is not configured.`,
    );

    return {
      action: 'alertEmergencyContact',
      status: 'deferred',
      detail:
        'No emergency contact webhook is configured; patient safety notification was created instead.',
      metadata: { notification_id: notification.notification_id },
    };
  }

  private async requestHumanReview(
    patientId: string,
    args: Record<string, unknown>,
    context: AgentPatientContext,
  ): Promise<AgentActionResult> {
    const priority = this.asString(args.priority, 'urgent');
    const summary = this.asString(
      args.summary,
      'Medication safety review requested.',
    );
    const rationale = this.asString(args.rationale);

    const notification = await this.notificationService.create(patientId, {
      title: 'Clinical review requested',
      message:
        priority === 'emergency'
          ? 'A possible urgent medication safety issue was detected. Seek emergency help now if you have severe symptoms.'
          : 'A medication safety review was flagged. Please review your care plan and contact your care team if needed.',
      type: NotificationType.SYSTEM_ALERT,
      metadata: {
        source: 'doctor_agent',
        action: 'requestHumanReview',
        priority,
        summary,
        rationale,
        trigger: context.trigger,
      },
    });

    this.logger.warn(
      `Human review requested for patient ${patientId}: ${priority} - ${summary}`,
    );

    return {
      action: 'requestHumanReview',
      status: 'executed',
      detail: `Human review flag stored in notification ${notification.notification_id}.`,
      metadata: { notification_id: notification.notification_id, priority },
    };
  }

  private async callEmergencySupport(
    patientId: string,
    args: Record<string, unknown>,
    context: AgentPatientContext,
  ): Promise<AgentActionResult> {
    const enabled =
      this.configService.get<string>('AGENT_ALLOW_EMERGENCY_WEBHOOK') ===
      'true';
    const webhookUrl = this.configService.get<string>(
      'EMERGENCY_SUPPORT_WEBHOOK_URL',
    );
    const reason = this.asString(args.reason, 'Emergency support requested.');
    const observedRisk = this.asString(args.observedRisk);

    if (enabled && webhookUrl) {
      await this.postWebhook(webhookUrl, {
        patient_id: patientId,
        action: 'callEmergencySupport',
        reason,
        observedRisk,
        instructions: this.asString(args.instructions),
        trigger: context.trigger,
      });

      return {
        action: 'callEmergencySupport',
        status: 'executed',
        detail: 'Emergency support webhook dispatched.',
      };
    }

    const notification = await this.notificationService.create(patientId, {
      title: 'Emergency support review requested',
      message:
        'A possible emergency was detected. If you have severe symptoms or feel unsafe, call local emergency services immediately.',
      type: NotificationType.SYSTEM_ALERT,
      metadata: {
        source: 'doctor_agent',
        action: 'callEmergencySupport',
        status: 'blocked_pending_configuration',
        reason,
        observedRisk,
        trigger: context.trigger,
      },
    });

    this.logger.error(
      `Emergency support call deferred for patient ${patientId}; AGENT_ALLOW_EMERGENCY_WEBHOOK and EMERGENCY_SUPPORT_WEBHOOK_URL are required.`,
    );

    return {
      action: 'callEmergencySupport',
      status: 'deferred',
      detail:
        'Emergency webhook is disabled or missing; patient emergency guidance notification was created instead.',
      metadata: { notification_id: notification.notification_id },
    };
  }

  private async postWebhook(url: string, body: Record<string, unknown>) {
    const timeoutMs = Number(
      this.configService.get<string>('AGENT_WEBHOOK_TIMEOUT_MS') ?? 10000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private getMedicationName(medication: any): string {
    return (
      medication?.prescription?.prescription?.[0]?.name ??
      medication?.prescription?.name ??
      medication?.name ??
      'Medication'
    );
  }

  private toDateOnly(date: Date) {
    return date.toISOString().split('T')[0];
  }

  private asString(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength
      ? `${value.slice(0, maxLength - 3)}...`
      : value;
  }
}
