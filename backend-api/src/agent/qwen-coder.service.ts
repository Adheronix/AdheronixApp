import { Injectable, Logger } from '@nestjs/common';
import { MedicationScheduleService } from '../medication/medication-schedule.service';
import { NotificationService } from '../notification/notification.service';
import { HealthScoreService } from '../health-score/health-score.service';
import { NotificationType } from '../notification/notification.entity';
import { OpenRouterService } from './open-router.service';
import {
  AgentPatientContext,
  HermesVerdict,
  ToolExecutionResult,
} from './agent.types';

@Injectable()
export class QwenCoderService {
  private readonly logger = new Logger(QwenCoderService.name);

  constructor(
    private readonly medicationScheduleService: MedicationScheduleService,
    private readonly notificationService: NotificationService,
    private readonly healthScoreService: HealthScoreService,
    private readonly openRouter: OpenRouterService,
  ) {}

  async executeActions(
    patientId: string,
    verdict: HermesVerdict,
    context: AgentPatientContext,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const action of verdict.actions) {
      try {
        const result = await this.executeAction(
          patientId,
          action,
          verdict,
          context,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Action ${action} failed: ${(error as Error).message}`,
        );
        results.push({
          tool: action,
          status: 'failed',
          result: {},
          error: (error as Error).message,
        });

        const fallbackResult = await this.executeFallback(
          patientId,
          action,
          verdict,
          context,
        );
        if (fallbackResult) {
          results.push(fallbackResult);
        }
      }
    }

    return results;
  }

  async handleDoseTaken(
    context: AgentPatientContext,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    try {
      const adherence =
        (context.adherence.weekly?.adherence_rate as number) ?? 100;
      const scoreUpdate = await this.healthScoreService.onDoseTaken(
        context.patient.patient_id,
        adherence,
        true,
      );

      results.push({
        tool: 'update_health_score',
        status: 'success',
        result: { new_score: scoreUpdate.score, delta: scoreUpdate.delta },
      });
    } catch (error) {
      results.push({
        tool: 'update_health_score',
        status: 'failed',
        result: {},
        error: (error as Error).message,
      });
    }

    return results;
  }

  async handleRefillTrigger(patientId: string): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    try {
      const healthScore = await this.healthScoreService.onRefill(
        patientId,
        100,
      );
      results.push({
        tool: 'update_health_score',
        status: 'success',
        result: { new_score: healthScore.score, delta: healthScore.delta },
      });
    } catch (error) {
      results.push({
        tool: 'update_health_score',
        status: 'failed',
        result: {},
        error: (error as Error).message,
      });
    }

    return results;
  }

  private async executeAction(
    patientId: string,
    action: string,
    verdict: HermesVerdict,
    context: AgentPatientContext,
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'trigger_chw_alert':
        return this.triggerChwAlert(patientId, verdict);

      case 'send_sms_caregiver':
        return this.sendSmsCaregiver(patientId, verdict);

      case 'send_notification':
        return this.sendNotification(patientId, verdict);

      case 'update_health_score':
        return this.updateHealthScore(patientId, context, verdict);

      case 'log_clinical_event':
        return this.logClinicalEvent(patientId, verdict);

      default:
        return {
          tool: action,
          status: 'failed',
          result: {},
          error: `Unknown action: ${action}`,
        };
    }
  }

  private async triggerChwAlert(
    patientId: string,
    verdict: HermesVerdict,
  ): Promise<ToolExecutionResult> {
    try {
      await this.notificationService.create(patientId, {
        title: 'CHW Alert: Patient requires attention',
        message: verdict.patient_explanation,
        type: NotificationType.SYSTEM_ALERT,
        metadata: {
          source: 'hermes_verdict',
          severity: verdict.severity,
          action: 'chw_alert',
        },
      });

      return {
        tool: 'trigger_chw_alert',
        status: 'success',
        result: { alert_created: true, severity: verdict.severity },
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendSmsCaregiver(
    patientId: string,
    verdict: HermesVerdict,
  ): Promise<ToolExecutionResult> {
    await this.notificationService.create(patientId, {
      title: 'Caregiver notification',
      message: `Attention needed: ${verdict.patient_explanation}`,
      type: NotificationType.SYSTEM_ALERT,
      metadata: {
        source: 'hermes_verdict',
        action: 'caregiver_sms',
        severity: verdict.severity,
      },
    });

    return {
      tool: 'send_sms_caregiver',
      status: 'success',
      result: { notification_stored: true },
    };
  }

  private async sendNotification(
    patientId: string,
    verdict: HermesVerdict,
  ): Promise<ToolExecutionResult> {
    await this.notificationService.create(patientId, {
      title: 'Health reminder',
      message: verdict.patient_explanation,
      type: NotificationType.MEDICATION_UPDATE,
      metadata: {
        source: 'hermes_verdict',
        severity: verdict.severity,
      },
    });

    return {
      tool: 'send_notification',
      status: 'success',
      result: { notification_created: true },
    };
  }

  private async updateHealthScore(
    patientId: string,
    context: AgentPatientContext,
    verdict: HermesVerdict,
  ): Promise<ToolExecutionResult> {
    const adherence =
      (context.adherence.weekly?.adherence_rate as number) ?? 100;
    const isCritical =
      verdict.severity === 'critical' || verdict.severity === 'high';
    const missedStreak = context.medication_summary.recent_missed_count;

    const scoreUpdate = await this.healthScoreService.onDoseMissed(
      patientId,
      adherence,
      isCritical,
      missedStreak,
    );

    return {
      tool: 'update_health_score',
      status: 'success',
      result: {
        new_score: scoreUpdate.score,
        delta: scoreUpdate.delta,
        severity: verdict.severity,
      },
    };
  }

  private async logClinicalEvent(
    patientId: string,
    verdict: HermesVerdict,
  ): Promise<ToolExecutionResult> {
    await this.notificationService.create(patientId, {
      title: 'Clinical event logged',
      message: `Event severity: ${verdict.severity}`,
      type: NotificationType.SYSTEM_ALERT,
      metadata: {
        source: 'clinical_event_log',
        severity: verdict.severity,
        verdict: {
          answer: verdict.answer,
          severity: verdict.severity,
          confidence: verdict.confidence,
        },
      },
    });

    return {
      tool: 'log_clinical_event',
      status: 'success',
      result: { event_logged: true },
    };
  }

  private async executeFallback(
    patientId: string,
    action: string,
    verdict: HermesVerdict,
    context: AgentPatientContext,
  ): Promise<ToolExecutionResult | null> {
    if (action === 'trigger_chw_alert') {
      try {
        return this.sendNotification(patientId, verdict);
      } catch {
        return null;
      }
    }

    if (action === 'send_sms_caregiver') {
      try {
        await this.notificationService.create(patientId, {
          title: 'Emergency: Caregiver notification failed',
          message: 'Please manually contact the caregiver.',
          type: NotificationType.SYSTEM_ALERT,
          metadata: { source: 'fallback', original_action: action },
        });
        return {
          tool: `${action}_fallback`,
          status: 'fallback',
          result: { fallback_notification_created: true },
        };
      } catch {
        return null;
      }
    }

    return null;
  }
}
