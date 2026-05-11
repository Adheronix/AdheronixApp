import { Injectable, Logger } from '@nestjs/common';
import { PatientService } from '../patient/patient.service';
import { MedicationService } from '../medication/medication.service';
import { MedicationScheduleService } from '../medication/medication-schedule.service';
import { HealthScoreService } from '../health-score/health-score.service';
import { AgentPatientContext } from './agent.types';

@Injectable()
export class ContextAssemblerService {
  private readonly logger = new Logger(ContextAssemblerService.name);

  constructor(
    private readonly patientService: PatientService,
    private readonly medicationService: MedicationService,
    private readonly medicationScheduleService: MedicationScheduleService,
    private readonly healthScoreService: HealthScoreService,
  ) {}

  async assembleFullContext(
    patientId: string,
    _eventType?: string,
  ): Promise<AgentPatientContext> {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const startDate = this.toDateOnly(start);
    const endDate = this.toDateOnly(now);

    const [
      patient,
      medications,
      weeklyAdherence,
      upcomingToday,
      scheduleHistory,
      healthScore,
    ] = await Promise.all([
      this.patientService.findById(patientId),
      this.medicationService.findAllForPatient(patientId),
      this.medicationScheduleService.getWeeklyAdherence(patientId),
      this.medicationScheduleService.getUpcomingMedications(patientId),
      this.medicationScheduleService.getScheduleHistory(
        patientId,
        startDate,
        endDate,
      ),
      this.healthScoreService.getCurrentScore(patientId).catch(() => null),
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
      (s) => s.status === 'missed',
    ).length;
    const recentSkippedCount = recentScheduleHistory.filter(
      (s) => s.status === 'skipped',
    ).length;
    const overdueTodayCount = upcomingToday.filter(
      (item: any) => item.status === 'pending' && item.time_until === 'Overdue',
    ).length;

    const patientData = patient as any;

    return {
      generated_at: now.toISOString(),
      data_sources: {
        medication_adherence: true,
        vitals: false,
        patient_logs: false,
      },
      patient: {
        patient_id: patientData.patient_id,
        role: patientData.role,
        age: patientData.age,
        gender: patientData.gender,
        conditions: patientData.conditions,
        allergies: patientData.allergies,
        has_emergency_contact: Boolean(patientData.emergency_contact_phone),
        preferred_language: patientData.preferred_language ?? 'english',
      },
      medication_summary: {
        active_medication_count: medications.length,
        recent_missed_count: recentMissedCount,
        recent_skipped_count: recentSkippedCount,
        overdue_today_count: overdueTodayCount,
      },
      medications: medications.map((med: any) => ({
        medication_id: med.medication_id,
        name: this.getMedicationName(med),
        frequency: med.frequency,
        period: med.period,
        intake_recommendation: med.intake_recommendation,
        source: med.source,
        issued_at: med.issued_at,
      })),
      adherence: {
        weekly: weeklyAdherence,
      },
      upcoming_today: upcomingToday,
      recent_schedule_history: recentScheduleHistory,
      health_score: healthScore
        ? {
            current: healthScore.score,
            delta: healthScore.delta,
            trend:
              healthScore.delta > 10
                ? 'up'
                : healthScore.delta < -10
                  ? 'down'
                  : 'stable',
            streak_current: healthScore.streak_current,
            streak_best: healthScore.streak_best,
          }
        : undefined,
    };
  }

  assembleTaskPacket(
    context: AgentPatientContext,
    classification: string,
    userMessage?: string,
  ): Record<string, unknown> {
    const basePacket: Record<string, unknown> = {
      event_type: classification,
      patient_id: context.patient.patient_id,
      generated_at: context.generated_at,
    };

    switch (classification) {
      case 'simple_chat':
      case 'schedule_query':
        return {
          ...basePacket,
          patient_name: (context.patient as any).full_names,
          current_medications: context.medications.map((m) => m.name),
          upcoming_today: context.upcoming_today,
          user_message: userMessage,
        };

      case 'medical_question':
      case 'ddi_query':
        return {
          ...basePacket,
          patient_age: context.patient.age,
          patient_conditions: context.patient.conditions,
          patient_allergies: context.patient.allergies,
          full_medication_list: context.medications,
          adherence_rate: context.adherence.weekly?.adherence_rate,
          missed_streak: context.medication_summary.recent_missed_count,
          user_message: userMessage,
        };

      case 'missed_dose_check':
        return {
          ...basePacket,
          patient_conditions: context.patient.conditions,
          medications_due: context.upcoming_today,
          missed_streak: context.medication_summary.recent_missed_count,
          adherence_rate: context.adherence.weekly?.adherence_rate,
          health_score: context.health_score,
        };

      case 'dose_taken_action':
        return {
          ...basePacket,
          health_score: context.health_score,
          adherence_rate: context.adherence.weekly?.adherence_rate,
          streak_current: context.health_score?.streak_current,
        };

      case 'health_score_update':
        return {
          ...basePacket,
          current_score: context.health_score?.current,
          adherence_rate: context.adherence.weekly?.adherence_rate,
          streak_current: context.health_score?.streak_current,
        };

      case 'simple_dashboard_load':
        return {
          ...basePacket,
          patient_name: (context.patient as any).full_names,
          health_score: context.health_score,
          adherence_rate: context.adherence.weekly?.adherence_rate,
          upcoming_today: context.upcoming_today,
          missed_count: context.medication_summary.recent_missed_count,
        };

      default:
        return {
          ...basePacket,
          full_context: context,
          user_message: userMessage,
        };
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

  private toDateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
