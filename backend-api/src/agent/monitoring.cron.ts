import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRole } from '../auth/user-role.enum';
import { PatientService } from '../patient/patient.service';
import { AiClientService } from './ai-client.service';
import { DoctorAgentService } from './doctor-agent.service';
import { AgentPatientContext, MonitorScreening } from './agent.types';

@Injectable()
export class MonitoringCron {
  private readonly logger = new Logger(MonitoringCron.name);

  constructor(
    private readonly patientService: PatientService,
    private readonly aiClientService: AiClientService,
    private readonly doctorAgentService: DoctorAgentService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleMonitoringSweep() {
    if (!this.isMonitoringEnabled()) {
      this.logger.debug(
        'Agent monitoring is disabled. Set AGENT_MONITORING_ENABLED=true to enable sweeps.',
      );
      return;
    }

    this.logger.log('Starting doctor agent monitoring sweep...');

    try {
      const patients = await this.patientService.findAll();
      const patientRecords = patients.filter(
        (patient: any) => patient.role === UserRole.PATIENT,
      );

      for (const patient of patientRecords as any[]) {
        await this.monitorPatient(patient.patient_id);
      }
    } catch (error) {
      this.logger.error(
        `Doctor agent monitoring sweep failed: ${(error as Error).message}`,
      );
    }
  }

  private async monitorPatient(patientId: string) {
    const context =
      await this.doctorAgentService.buildPatientContext(patientId);
    const deterministicScreening = this.screenDeterministically(context);
    let modelScreening: MonitorScreening | null = null;

    if (this.aiClientService.isConfigured()) {
      try {
        modelScreening =
          await this.aiClientService.screenPatientContext(context);
      } catch (error) {
        this.logger.error(
          `Background monitor model failed for patient ${patientId}: ${
            (error as Error).message
          }`,
        );
      }
    }

    const shouldEscalate =
      deterministicScreening.escalate || Boolean(modelScreening?.escalate);

    if (!shouldEscalate) {
      this.logger.debug(`No agent escalation needed for patient ${patientId}`);
      return;
    }

    const reasons = [
      ...deterministicScreening.reasons,
      ...(modelScreening?.reasons ?? []),
    ];

    this.logger.warn(
      `Escalating patient ${patientId} to primary doctor agent: ${reasons.join(
        '; ',
      )}`,
    );

    await this.doctorAgentService.evaluatePatient(patientId, {
      source: 'background_monitor',
      screening: modelScreening,
      deterministic_findings: deterministicScreening.reasons,
      reason: reasons.join('; '),
    });
  }

  private screenDeterministically(
    context: AgentPatientContext,
  ): MonitorScreening {
    const reasons: string[] = [];
    const adherenceRate = Number(
      context.adherence.weekly?.adherence_rate ?? 100,
    );
    const totalScheduled = Number(
      context.adherence.weekly?.total_scheduled ?? 0,
    );

    if (context.medication_summary.overdue_today_count > 0) {
      reasons.push(
        `${context.medication_summary.overdue_today_count} medication dose(s) are overdue today.`,
      );
    }

    if (context.medication_summary.recent_missed_count >= 3) {
      reasons.push(
        `${context.medication_summary.recent_missed_count} missed dose(s) in the last 7 days.`,
      );
    }

    if (context.medication_summary.recent_skipped_count >= 3) {
      reasons.push(
        `${context.medication_summary.recent_skipped_count} skipped dose(s) in the last 7 days.`,
      );
    }

    if (totalScheduled >= 4 && adherenceRate <= 50) {
      reasons.push(
        `Weekly adherence is ${adherenceRate}% across ${totalScheduled} scheduled dose(s).`,
      );
    }

    return {
      escalate: reasons.length > 0,
      severity:
        reasons.length > 1 ? 'high' : reasons.length === 1 ? 'medium' : 'none',
      reasons,
      recommended_action:
        reasons.length > 0
          ? 'Escalate to the primary decision engine for medication safety triage.'
          : 'No action needed.',
      confidence: 1,
      fallback: true,
    };
  }

  private isMonitoringEnabled() {
    return (
      this.configService.get<string>('AGENT_MONITORING_ENABLED') === 'true'
    );
  }
}
