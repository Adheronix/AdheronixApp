import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './open-router.service';
import { ContextAssemblerService } from './context-assembler.service';
import { ResponseFormatterService } from './response-formatter.service';
import { LanguageDetectionService } from './language-detection.service';
import { HermesService } from './hermes.service';
import { QwenCoderService } from './qwen-coder.service';
import { LlamaFastService } from './llama-fast.service';
import { QwenKinyarwandaService } from './qwen-kinyarwanda.service';
import {
  AgentPatientContext,
  ChatMessage,
  EventClassification,
  RoutingDecision,
  AgenticResponse,
  ToolExecutionResult,
} from './agent.types';

@Injectable()
export class MiniMaxOrchestratorService {
  private readonly logger = new Logger(MiniMaxOrchestratorService.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly contextAssembler: ContextAssemblerService,
    private readonly responseFormatter: ResponseFormatterService,
    private readonly langDetection: LanguageDetectionService,
    private readonly hermes: HermesService,
    private readonly qwenCoder: QwenCoderService,
    private readonly llamaFast: LlamaFastService,
    private readonly qwenKinyarwanda: QwenKinyarwandaService,
  ) {}

  async handleEvent(
    patientId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    eventType?: string,
  ): Promise<AgenticResponse> {
    const context = await this.contextAssembler.assembleFullContext(
      patientId,
      eventType,
    );
    const detectedLang = await this.langDetection.detectLanguage(userMessage);
    const isKinyarwandaOrFrench =
      detectedLang === 'kinyarwanda' || detectedLang === 'french';

    this.logger.log(
      `Event routed for patient ${patientId}: lang=${detectedLang}, type=${eventType ?? 'chat'}`,
    );

    const routing = await this.classifyEvent(
      context,
      userMessage,
      detectedLang,
      eventType,
    );

    this.logger.log(
      `Classification: ${routing.classification} (confidence: ${routing.confidence})`,
    );

    const result = await this.routeAndExecute(
      context,
      routing,
      userMessage,
      conversationHistory,
      detectedLang,
    );

    return result;
  }

  async handleDashboardLoad(patientId: string): Promise<AgenticResponse> {
    const context = await this.contextAssembler.assembleFullContext(
      patientId,
      'page_load',
    );

    const greeting = await this.llamaFast.generateGreeting(context);

    return {
      message: greeting,
      formatted_message: this.responseFormatter.formatForChat(greeting),
      classification: 'simple_dashboard_load',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      actions_taken: [],
      metadata: {
        health_score: context.health_score,
        upcoming_today: context.upcoming_today,
        adherence_rate: context.adherence.weekly?.adherence_rate,
      },
    };
  }

  private async classifyEvent(
    context: AgentPatientContext,
    userMessage: string,
    detectedLang: string,
    eventType?: string,
  ): Promise<RoutingDecision> {
    if (eventType === 'missed_dose') {
      return {
        classification: 'missed_dose_check',
        confidence: 1,
        model: 'hardcoded',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'missed_dose_check',
        ),
      };
    }

    if (eventType === 'dose_taken') {
      return {
        classification: 'dose_taken_action',
        confidence: 1,
        model: 'hardcoded',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'dose_taken_action',
        ),
      };
    }

    if (eventType === 'page_load') {
      return {
        classification: 'simple_dashboard_load',
        confidence: 1,
        model: 'hardcoded',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'simple_dashboard_load',
        ),
      };
    }

    if (detectedLang === 'kinyarwanda' || detectedLang === 'french') {
      if (this.looksLikeMedicalQuestion(userMessage)) {
        return {
          classification: 'medical_question',
          confidence: 0.8,
          model: 'hardcoded',
          taskPacket: this.contextAssembler.assembleTaskPacket(
            context,
            'medical_question',
            userMessage,
          ),
        };
      }
      return {
        classification: 'kinyarwanda_input',
        confidence: 0.85,
        model: 'hardcoded',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'kinyarwanda_input',
          userMessage,
        ),
      };
    }

    try {
      const model = this.openRouter.getModelConfig(
        'MINIMAX_MODEL',
        'minimax/minimax-m2.5:free',
      );

      const contextSummary = JSON.stringify({
        patient_age: context.patient.age,
        conditions: context.patient.conditions,
        medication_count: context.medications.length,
        adherence_rate: context.adherence.weekly?.adherence_rate,
        missed_count: context.medication_summary.recent_missed_count,
        health_score: context.health_score?.current,
      });

      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `You are the event classifier for a medication adherence app. Classify the user's input into exactly ONE category.

Categories:
- simple_chat: greetings, general questions, app navigation
- medical_question: questions about medications, side effects, interactions, health advice
- ddi_query: specifically about drug-drug interactions ("can I take X with Y")
- schedule_query: questions about dose times, schedules, refill dates
- missed_dose_check: patient reporting they missed a dose
- dose_taken_action: patient reporting they took a dose

Respond with ONLY a JSON object: {"classification": "<category>", "confidence": 0.95}`,
          },
          {
            role: 'system',
            content: `Patient context: ${contextSummary}`,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        {
          temperature: 0,
          max_tokens: 100,
          response_format: { type: 'json_object' },
          fallbackModels: ['openrouter/free'],
        },
      );

      const content = response.choices?.[0]?.message?.content;
      const parsed = this.openRouter.parseJsonObject(content ?? '');

      if (parsed?.classification) {
        const classification = String(parsed.classification);
        const confidence =
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;

        return {
          classification: classification as EventClassification,
          confidence,
          model: response.model ?? model,
          taskPacket: this.contextAssembler.assembleTaskPacket(
            context,
            classification,
            userMessage,
          ),
        };
      }
    } catch (error) {
      this.logger.warn(
        `MiniMax classification failed, using fallback: ${(error as Error).message}`,
      );
    }

    return this.fallbackClassify(userMessage, context);
  }

  private async routeAndExecute(
    context: AgentPatientContext,
    routing: RoutingDecision,
    userMessage: string,
    conversationHistory: ChatMessage[],
    detectedLang: string,
  ): Promise<AgenticResponse> {
    switch (routing.classification) {
      case 'simple_chat':
        return this.handleSimpleChat(context, userMessage, conversationHistory);

      case 'schedule_query':
        return this.handleScheduleQuery(
          context,
          userMessage,
          conversationHistory,
        );

      case 'medical_question':
      case 'ddi_query':
        return this.handleMedicalQuestion(
          context,
          userMessage,
          conversationHistory,
          detectedLang,
        );

      case 'missed_dose_check':
        return this.handleMissedDose(context);

      case 'dose_taken_action':
        return this.handleDoseTaken(context);

      case 'kinyarwanda_input':
        return this.handleKinyarwandaInput(
          context,
          userMessage,
          conversationHistory,
        );

      case 'simple_dashboard_load':
        return this.handleDashboardLoad(context.patient.patient_id);

      default:
        return this.handleSimpleChat(context, userMessage, conversationHistory);
    }
  }

  private async handleSimpleChat(
    context: AgentPatientContext,
    userMessage: string,
    history: ChatMessage[],
  ): Promise<AgenticResponse> {
    const response = await this.llamaFast.simpleChat(
      context,
      userMessage,
      history,
    );

    return {
      message: response,
      formatted_message: this.responseFormatter.formatForChat(response),
      classification: 'simple_chat',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      actions_taken: [],
      metadata: {},
    };
  }

  private async handleScheduleQuery(
    context: AgentPatientContext,
    userMessage: string,
    history: ChatMessage[],
  ): Promise<AgenticResponse> {
    const response = await this.llamaFast.scheduleQuery(
      context,
      userMessage,
      history,
    );

    return {
      message: response,
      formatted_message: this.responseFormatter.formatForChat(response),
      classification: 'schedule_query',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      actions_taken: [],
      metadata: {},
    };
  }

  private async handleMedicalQuestion(
    context: AgentPatientContext,
    userMessage: string,
    history: ChatMessage[],
    detectedLang: string,
  ): Promise<AgenticResponse> {
    const verdict = await this.hermes.reason(context, userMessage);

    const actionsTaken: ToolExecutionResult[] = [];

    if (verdict.requires_action && verdict.actions.length > 0) {
      const results = await this.qwenCoder.executeActions(
        context.patient.patient_id,
        verdict,
        context,
      );
      actionsTaken.push(...results);
    }

    let patientMessage = verdict.patient_explanation;

    if (detectedLang === 'french') {
      patientMessage =
        await this.qwenKinyarwanda.handleFrenchResponse(patientMessage);
    }

    return {
      message: patientMessage,
      formatted_message: this.responseFormatter.formatForChat(patientMessage),
      classification: 'medical_question',
      model: 'nousresearch/hermes-3-llama-3.1-405b:free',
      actions_taken: actionsTaken,
      metadata: {
        severity: verdict.severity,
        confidence: verdict.confidence,
        rag_sources: verdict.rag_sources,
      },
    };
  }

  private async handleMissedDose(
    context: AgentPatientContext,
  ): Promise<AgenticResponse> {
    const verdict = await this.hermes.reasonMissedDose(context);

    const actionsTaken: ToolExecutionResult[] = [];

    if (verdict.requires_action) {
      const results = await this.qwenCoder.executeActions(
        context.patient.patient_id,
        verdict,
        context,
      );
      actionsTaken.push(...results);
    }

    return {
      message: verdict.patient_explanation,
      formatted_message: this.responseFormatter.formatForChat(
        verdict.patient_explanation,
      ),
      classification: 'missed_dose_check',
      model: 'nousresearch/hermes-3-llama-3.1-405b:free',
      actions_taken: actionsTaken,
      metadata: {
        severity: verdict.severity,
      },
    };
  }

  private async handleDoseTaken(
    context: AgentPatientContext,
  ): Promise<AgenticResponse> {
    const results = await this.qwenCoder.handleDoseTaken(context);

    const encouragement =
      await this.llamaFast.generateDoseTakenEncouragement(context);

    return {
      message: encouragement,
      formatted_message: this.responseFormatter.formatForChat(encouragement),
      classification: 'dose_taken_action',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      actions_taken: results,
      metadata: {},
    };
  }

  private async handleKinyarwandaInput(
    context: AgentPatientContext,
    userMessage: string,
    history: ChatMessage[],
  ): Promise<AgenticResponse> {
    const cleanedEnglish =
      await this.qwenKinyarwanda.preprocessKinyarwanda(userMessage);

    const looksMedical = this.looksLikeMedicalQuestion(cleanedEnglish);

    let englishResponse: string;

    if (looksMedical) {
      const adaptedContext = {
        ...context,
        patient: {
          ...context.patient,
          conditions: context.patient.conditions,
        },
      };
      const verdict = await this.hermes.reason(adaptedContext, cleanedEnglish);
      englishResponse = verdict.patient_explanation;
    } else {
      englishResponse = await this.llamaFast.simpleChat(
        context,
        cleanedEnglish,
        history,
      );
    }

    const polishedKinyarwanda =
      await this.qwenKinyarwanda.postprocessToKinyarwanda(englishResponse);

    return {
      message: polishedKinyarwanda,
      formatted_message:
        this.responseFormatter.formatForChat(polishedKinyarwanda),
      classification: 'kinyarwanda_input',
      model: 'qwen/qwen3-next-80b-a3b-instruct:free',
      actions_taken: [],
      metadata: {
        original_language: 'kinyarwanda',
        translated_question: cleanedEnglish,
      },
    };
  }

  private fallbackClassify(
    userMessage: string,
    context: AgentPatientContext,
  ): RoutingDecision {
    const lower = userMessage.toLowerCase();

    if (
      lower.includes('interaction') ||
      lower.includes('together') ||
      lower.includes('with my') ||
      lower.includes('safe to take')
    ) {
      return {
        classification: 'ddi_query',
        confidence: 0.6,
        model: 'fallback',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'ddi_query',
          userMessage,
        ),
      };
    }

    if (
      lower.includes('missed') ||
      lower.includes('forgot') ||
      lower.includes('skip')
    ) {
      return {
        classification: 'missed_dose_check',
        confidence: 0.6,
        model: 'fallback',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'missed_dose_check',
          userMessage,
        ),
      };
    }

    if (
      lower.includes('taken') ||
      lower.includes('took') ||
      lower.includes('dose')
    ) {
      return {
        classification: 'dose_taken_action',
        confidence: 0.6,
        model: 'fallback',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'dose_taken_action',
          userMessage,
        ),
      };
    }

    if (
      lower.includes('when') ||
      lower.includes('time') ||
      lower.includes('schedule') ||
      lower.includes('refill')
    ) {
      return {
        classification: 'schedule_query',
        confidence: 0.6,
        model: 'fallback',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'schedule_query',
          userMessage,
        ),
      };
    }

    if (
      lower.includes('side effect') ||
      lower.includes('pain') ||
      lower.includes('feel') ||
      lower.includes('hurt') ||
      lower.includes('sick') ||
      lower.includes('wrong') ||
      lower.includes('should i') ||
      lower.includes('what if')
    ) {
      return {
        classification: 'medical_question',
        confidence: 0.6,
        model: 'fallback',
        taskPacket: this.contextAssembler.assembleTaskPacket(
          context,
          'medical_question',
          userMessage,
        ),
      };
    }

    return {
      classification: 'simple_chat',
      confidence: 0.5,
      model: 'fallback',
      taskPacket: this.contextAssembler.assembleTaskPacket(
        context,
        'simple_chat',
        userMessage,
      ),
    };
  }

  private looksLikeMedicalQuestion(message: string): boolean {
    const medicalKeywords = [
      'drug',
      'medicine',
      'medication',
      'dose',
      'pill',
      'tablet',
      'side effect',
      'interaction',
      'allergy',
      'allergic',
      'pain',
      'hurt',
      'sick',
      'dizzy',
      'nausea',
      'vomiting',
      'blood pressure',
      'blood sugar',
      'heart',
      'diabetes',
      'can i take',
      'should i take',
      'is it safe',
      'what if',
      'how much',
      'how many',
      'when should',
    ];

    const lower = message.toLowerCase();
    return medicalKeywords.some((keyword) => lower.includes(keyword));
  }
}
