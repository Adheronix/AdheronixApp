import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './open-router.service';
import { RagService } from './rag.service';
import {
  AgentPatientContext,
  HermesVerdict,
  AgentSeverity,
} from './agent.types';

@Injectable()
export class HermesService {
  private readonly logger = new Logger(HermesService.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly rag: RagService,
  ) {}

  async reason(
    context: AgentPatientContext,
    userQuestion: string,
  ): Promise<HermesVerdict> {
    const { context: ragContext, sources } = await this.rag.getContextForQuery(
      userQuestion,
      5,
    );

    const model = this.openRouter.resolveModel(
      'HERMES_MODEL',
      'nousresearch/hermes-3-llama-3.1-405b:free',
      'llama-3.3-70b-versatile',
    );

    const medicationList = context.medications
      .map((m) => `- ${m.name} (${m.frequency}x per ${m.period ?? 'day'})`)
      .join('\n');

    const systemPrompt = `You are a medical safety reasoning engine for a medication adherence app. You are NOT a replacement for a licensed clinician and must NOT provide diagnoses.

Your job is to:
1. Review the retrieved medical reference context
2. Consider the patient's specific situation (medications, conditions, age)
3. Provide a safe, evidence-based answer

Rules:
- Always advise seeking professional medical help for urgent concerns
- Never provide specific dosage changes
- Be calm, clear, and actionable
- If uncertain, recommend consulting a healthcare provider

Respond with ONLY a JSON object:
{
  "answer": "detailed answer in plain English",
  "severity": "none|low|medium|high|critical",
  "requires_action": true/false,
  "actions": ["action1", "action2"],
  "patient_explanation": "simplified explanation for the patient in plain, warm language",
  "confidence": 0.9,
  "rag_sources": ["source1", "source2"]
}`;

    const userPrompt = `Patient context:
Age: ${context.patient.age ?? 'unknown'}
Conditions: ${context.patient.conditions ?? 'none reported'}
Allergies: ${context.patient.allergies ?? 'none reported'}
Current medications:
${medicationList}
Adherence rate: ${context.adherence.weekly?.adherence_rate ?? 'unknown'}%

Medical reference context:
${ragContext}

Patient question: ${userQuestion}`;

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          fallbackModels: [
            'openrouter/free',
            'meta-llama/llama-3.3-70b-instruct:free',
          ],
        },
      );

      const content = response.choices?.[0]?.message?.content ?? '';
      const parsed = this.openRouter.parseJsonObject(content);

      if (parsed) {
        return {
          answer: (parsed.answer as string) ?? '',
          severity: this.normalizeSeverity(parsed.severity),
          requires_action: Boolean(parsed.requires_action),
          actions: Array.isArray(parsed.actions)
            ? parsed.actions.map(String)
            : [],
          patient_explanation:
            (parsed.patient_explanation as string) ??
            (parsed.answer as string) ??
            '',
          confidence:
            typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
          rag_sources:
            sources.length > 0
              ? sources
              : Array.isArray(parsed.rag_sources)
                ? parsed.rag_sources.map(String)
                : [],
        };
      }
    } catch (error) {
      this.logger.error(`Hermes reasoning failed: ${(error as Error).message}`);
    }

    return this.fallbackVerdict(userQuestion, context, sources);
  }

  async reasonMissedDose(context: AgentPatientContext): Promise<HermesVerdict> {
    const missedStreak = context.medication_summary.recent_missed_count;
    const conditions = (context.patient.conditions ?? '').toLowerCase();
    const isCritical =
      conditions.includes('epilepsy') ||
      conditions.includes('seizure') ||
      conditions.includes('diabetes');

    let severity: AgentSeverity = 'low';
    let requiresAction = false;
    let actions: string[] = [];
    let explanation = '';

    if (isCritical && missedStreak >= 1) {
      severity = 'critical';
      requiresAction = true;
      actions = [
        'trigger_chw_alert',
        'send_sms_caregiver',
        'update_health_score',
      ];
      explanation = `This is important. Missing your medication can be dangerous with your condition. Your community health worker has been notified. Please take your medication as soon as possible and contact your health center if you feel unwell.`;
    } else if (missedStreak >= 3) {
      severity = 'high';
      requiresAction = true;
      actions = ['update_health_score', 'send_notification'];
      explanation = `You have missed several doses. This can affect your treatment. Please try to get back on schedule with your next dose. Contact your health center if you are having trouble taking your medication.`;
    } else if (missedStreak >= 2) {
      severity = 'medium';
      requiresAction = true;
      actions = ['update_health_score'];
      explanation = `We noticed you missed your medication. Try to take your next dose on time. If you are having side effects or trouble taking your medication, please tell your health worker.`;
    } else {
      severity = 'low';
      explanation = `It is okay, everyone misses a dose sometimes. Just take your next dose at the scheduled time. Do not take two doses at once unless your doctor has told you to.`;
    }

    return {
      answer: explanation,
      severity,
      requires_action: requiresAction,
      actions,
      patient_explanation: explanation,
      confidence: 0.95,
      rag_sources: ['deterministic_missed_dose_logic'],
    };
  }

  private normalizeSeverity(value: unknown): AgentSeverity {
    const valid: AgentSeverity[] = [
      'none',
      'low',
      'medium',
      'high',
      'critical',
    ];
    if (typeof value === 'string' && valid.includes(value as AgentSeverity)) {
      return value as AgentSeverity;
    }
    return 'none';
  }

  private fallbackVerdict(
    question: string,
    context: AgentPatientContext,
    sources: string[],
  ): HermesVerdict {
    return {
      answer: `Based on your current medications and health profile, I recommend discussing this question with your healthcare provider. For general guidance, always follow your prescribed medication schedule and report any unusual symptoms to your health worker.`,
      severity: 'low',
      requires_action: false,
      actions: [],
      patient_explanation: `I recommend talking to your healthcare provider about this. They know your full medical history and can give you the best advice. In the meantime, continue taking your medications as prescribed.`,
      confidence: 0.4,
      rag_sources: sources,
    };
  }
}
