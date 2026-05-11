import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './open-router.service';
import { AgentPatientContext, ChatMessage } from './agent.types';

@Injectable()
export class LlamaFastService {
  private readonly logger = new Logger(LlamaFastService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async simpleChat(
    context: AgentPatientContext,
    userMessage: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return this.fallbackResponse(userMessage);
    }

    const model = this.openRouter.getModelConfig(
      'LLAMA_FAST_MODEL',
      'meta-llama/llama-3.3-70b-instruct:free',
    );

    const patientName = this.extractPatientName(context);
    const medications = context.medications.map((m) => m.name).join(', ');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are Adheronix, a friendly medication adherence assistant. You are helpful, warm, and concise. You help patients with questions about their medication schedules, reminders, and general health guidance. You are NOT a replacement for a licensed medical professional. Never provide diagnoses.

Patient: ${patientName}
Current medications: ${medications || 'None'}
Adherence rate: ${context.adherence.weekly?.adherence_rate ?? 'unknown'}%`,
      },
      ...history.slice(-5),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.openRouter.chatCompletion(model, messages, {
        temperature: 0.7,
        max_tokens: 500,
        fallbackModels: ['openrouter/free'],
      });

      return (
        response.choices?.[0]?.message?.content?.trim() ??
        this.fallbackResponse(userMessage)
      );
    } catch (error) {
      this.logger.warn(`Llama fast chat failed: ${(error as Error).message}`);
      return this.fallbackResponse(userMessage);
    }
  }

  async scheduleQuery(
    context: AgentPatientContext,
    userMessage: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return this.fallbackScheduleResponse(context);
    }

    const model = this.openRouter.getModelConfig(
      'LLAMA_FAST_MODEL',
      'meta-llama/llama-3.3-70b-instruct:free',
    );

    const upcomingToday = context.upcoming_today
      .map(
        (d: any) =>
          `- ${d.medication_name} at ${d.scheduled_time} (${d.status})`,
      )
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are Adheronix, a medication schedule assistant. Answer questions about the patient's schedule using ONLY the data provided below. Be precise and concise.

Today's schedule:
${upcomingToday || 'No doses scheduled today'}

Adherence rate: ${context.adherence.weekly?.adherence_rate ?? 'unknown'}%`,
      },
      ...history.slice(-5),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.openRouter.chatCompletion(model, messages, {
        temperature: 0.3,
        max_tokens: 400,
        fallbackModels: ['openrouter/free'],
      });

      return (
        response.choices?.[0]?.message?.content?.trim() ??
        this.fallbackScheduleResponse(context)
      );
    } catch (error) {
      this.logger.warn(
        `Llama schedule query failed: ${(error as Error).message}`,
      );
      return this.fallbackScheduleResponse(context);
    }
  }

  async generateGreeting(context: AgentPatientContext): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return this.defaultGreeting(context);
    }

    const model = this.openRouter.getModelConfig(
      'LLAMA_FAST_MODEL',
      'meta-llama/llama-3.3-70b-instruct:free',
    );

    const patientName = this.extractPatientName(context);
    const adherence = context.adherence.weekly?.adherence_rate ?? 100;
    const upcomingCount = context.upcoming_today.length;
    const missedCount = context.medication_summary.recent_missed_count;
    const scoreTrend = context.health_score?.trend ?? 'stable';

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `Generate a warm, personalized morning greeting for a medication adherence app patient. Keep it brief (2-3 sentences). Mention their adherence, upcoming doses, and health score trend if positive. Be encouraging.

Patient: ${patientName}
Yesterday adherence: ${adherence}%
Doses today: ${upcomingCount}
Recent misses: ${missedCount}
Health score trend: ${scoreTrend}`,
          },
          {
            role: 'user',
            content: 'Generate my morning greeting',
          },
        ],
        {
          temperature: 0.8,
          max_tokens: 150,
          fallbackModels: ['openrouter/free'],
        },
      );

      return (
        response.choices?.[0]?.message?.content?.trim() ??
        this.defaultGreeting(context)
      );
    } catch (error) {
      this.logger.warn(
        `Greeting generation failed: ${(error as Error).message}`,
      );
      return this.defaultGreeting(context);
    }
  }

  async generateDoseTakenEncouragement(
    context: AgentPatientContext,
  ): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return 'Great job taking your medication! Keep up the good work.';
    }

    const model = this.openRouter.getModelConfig(
      'LLAMA_FAST_MODEL',
      'meta-llama/llama-3.3-70b-instruct:free',
    );

    const streak = context.health_score?.streak_current ?? 0;
    const score = context.health_score?.current ?? 500;

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `Generate a brief encouraging message for a patient who just took their medication. Current streak: ${streak} doses. Health score: ${score}. Keep it warm and brief (1-2 sentences).`,
          },
          { role: 'user', content: 'I just took my dose' },
        ],
        {
          temperature: 0.8,
          max_tokens: 100,
          fallbackModels: ['openrouter/free'],
        },
      );

      return (
        response.choices?.[0]?.message?.content?.trim() ??
        'Great job taking your medication! Keep up the good work.'
      );
    } catch {
      return 'Great job taking your medication! Keep up the good work.';
    }
  }

  async generateNotificationCopy(
    type: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return this.defaultNotificationCopy(type, context);
    }

    const model = this.openRouter.getModelConfig(
      'LLAMA_FAST_MODEL',
      'meta-llama/llama-3.3-70b-instruct:free',
    );

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `Generate a brief notification message for type: ${type}. Context: ${JSON.stringify(context)}. Keep it under 120 characters. Be clear and action-oriented.`,
          },
          { role: 'user', content: `Generate notification for: ${type}` },
        ],
        {
          temperature: 0.7,
          max_tokens: 80,
          fallbackModels: ['openrouter/free'],
        },
      );

      return (
        response.choices?.[0]?.message?.content?.trim() ??
        this.defaultNotificationCopy(type, context)
      );
    } catch {
      return this.defaultNotificationCopy(type, context);
    }
  }

  private fallbackResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();

    if (
      lower.includes('hello') ||
      lower.includes('hi') ||
      lower.includes('muraho')
    ) {
      return 'Hello! How can I help you with your medications today?';
    }

    if (lower.includes('time') || lower.includes('when')) {
      return 'You can check your medication schedule in the Doses tab. Let me know if you need help with anything else!';
    }

    return 'I understand. For specific medical advice, please consult your healthcare provider. Is there anything about your medication schedule I can help with?';
  }

  private fallbackScheduleResponse(context: AgentPatientContext): string {
    const upcoming = context.upcoming_today
      .map((d: any) => `${d.medication_name} at ${d.scheduled_time}`)
      .join(', ');

    return upcoming
      ? `Your upcoming doses today: ${upcoming}.`
      : 'You have no more doses scheduled for today. Great job staying on track!';
  }

  private defaultGreeting(context: AgentPatientContext): string {
    const name = this.extractPatientName(context);
    const adherence = context.adherence.weekly?.adherence_rate ?? 100;
    const upcoming = context.upcoming_today.length;

    return `Good morning${name ? ` ${name}` : ''}! Your adherence is at ${adherence}%. You have ${upcoming} dose${upcoming !== 1 ? 's' : ''} scheduled today. Keep it up!`;
  }

  private defaultNotificationCopy(
    type: string,
    context: Record<string, unknown>,
  ): string {
    switch (type) {
      case 'medication_reminder':
        return `Time to take your ${context.medication_name ?? 'medication'}.`;
      case 'dose_missed':
        return `You missed your ${context.medication_name ?? 'medication'} dose. Take it as soon as you can.`;
      case 'health_score_update':
        return `Your Health Credit Score is now ${(context.score as number) ?? 500}.`;
      case 'refill_reminder':
        return `Your ${context.medication_name ?? 'medication'} refill is due soon.`;
      default:
        return 'You have a new notification from Adheronix.';
    }
  }

  private extractPatientName(context: AgentPatientContext): string {
    const patientData = context.patient as Record<string, unknown>;
    return (patientData.full_names as string) ?? '';
  }
}
