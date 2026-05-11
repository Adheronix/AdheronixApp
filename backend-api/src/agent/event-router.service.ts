import { Injectable, Logger } from '@nestjs/common';
import { MiniMaxOrchestratorService } from './minimax-orchestrator.service';
import { ContextAssemblerService } from './context-assembler.service';
import { ResponseFormatterService } from './response-formatter.service';
import { OcrService } from './ocr.service';
import { RagService } from './rag.service';
import { HermesService } from './hermes.service';
import { QwenCoderService } from './qwen-coder.service';
import {
  AgenticResponse,
  ChatMessage,
  EventClassification,
  ToolExecutionResult,
} from './agent.types';

export interface AgentEventRequest {
  patientId: string;
  eventType: string;
  userMessage?: string;
  conversationHistory?: ChatMessage[];
  imageData?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EventRouterService {
  private readonly logger = new Logger(EventRouterService.name);

  constructor(
    private readonly orchestrator: MiniMaxOrchestratorService,
    private readonly contextAssembler: ContextAssemblerService,
    private readonly responseFormatter: ResponseFormatterService,
    private readonly ocr: OcrService,
    private readonly rag: RagService,
    private readonly hermes: HermesService,
    private readonly qwenCoder: QwenCoderService,
  ) {}

  async handleEvent(request: AgentEventRequest): Promise<AgenticResponse> {
    this.logger.log(
      `Handling event: type=${request.eventType}, patient=${request.patientId}`,
    );

    switch (request.eventType) {
      case 'chat':
        return this.handleChat(request);

      case 'dashboard_load':
        return this.orchestrator.handleDashboardLoad(request.patientId);

      case 'dose_taken':
        return this.handleDoseTaken(request);

      case 'missed_dose':
        return this.handleMissedDose(request);

      case 'ocr_scan':
        return this.handleOcrScan(request);

      case 'refill_trigger':
        return this.handleRefillTrigger(request);

      case 'health_score_query':
        return this.handleHealthScoreQuery(request);

      case 'seed_knowledge':
        return this.handleSeedKnowledge(request);

      default:
        return this.handleChat(request);
    }
  }

  private async handleChat(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    return this.orchestrator.handleEvent(
      request.patientId,
      request.userMessage ?? '',
      request.conversationHistory ?? [],
      request.eventType,
    );
  }

  private async handleDoseTaken(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    const context = await this.contextAssembler.assembleFullContext(
      request.patientId,
      'dose_taken',
    );

    return this.orchestrator.handleEvent(
      request.patientId,
      'I just took my medication',
      [],
      'dose_taken',
    );
  }

  private async handleMissedDose(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    const context = await this.contextAssembler.assembleFullContext(
      request.patientId,
      'missed_dose',
    );

    return this.orchestrator.handleEvent(
      request.patientId,
      'I missed my dose',
      [],
      'missed_dose',
    );
  }

  private async handleOcrScan(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    if (!request.imageData) {
      return {
        message: 'No image provided for OCR scanning.',
        formatted_message: 'No image provided for OCR scanning.',
        classification: 'ocr_scan_required',
        model: 'ocr',
        actions_taken: [],
        metadata: { error: 'no_image' },
      };
    }

    const ocrResult = await this.ocr.extractPrescription(request.imageData);

    if (ocrResult.medications.length === 0) {
      return {
        message:
          'I could not read any medications from the image. Please try again with a clearer photo.',
        formatted_message:
          'I could not read any medications from the image. Please try again with a clearer photo.',
        classification: 'ocr_scan_required',
        model: 'ocr',
        actions_taken: [],
        metadata: { ocr_result: ocrResult },
      };
    }

    const medNames = ocrResult.medications.map((m) => m.name).join(', ');
    const context = await this.contextAssembler.assembleFullContext(
      request.patientId,
      'ocr_scan',
    );

    const verdict = await this.hermes.reason(
      context,
      `Are these medications safe to add to my current regimen? ${medNames}`,
    );

    let actionsTaken: ToolExecutionResult[] = [];
    if (
      !verdict.requires_action &&
      verdict.severity !== 'critical' &&
      verdict.severity !== 'high'
    ) {
      actionsTaken = await this.qwenCoder.handleRefillTrigger(
        request.patientId,
      );
    }

    const formattedMeds = ocrResult.medications
      .map(
        (m) =>
          `- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}${m.frequency ? `, ${m.frequency}` : ''}`,
      )
      .join('\n');

    const message = `I found these medications on your prescription:\n\n${formattedMeds}\n\n${verdict.patient_explanation}`;

    return {
      message,
      formatted_message: this.responseFormatter.formatForChat(message),
      classification: 'ocr_scan_required',
      model: 'ocr + hermes',
      actions_taken: actionsTaken,
      metadata: {
        ocr_result: ocrResult,
        ddi_verdict: verdict,
      },
    };
  }

  private async handleRefillTrigger(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    const results = await this.qwenCoder.handleRefillTrigger(request.patientId);

    const context = await this.contextAssembler.assembleFullContext(
      request.patientId,
      'refill',
    );

    const message = `Your refill has been triggered. ${context.medications.length} medication(s) are being processed.`;

    return {
      message,
      formatted_message: this.responseFormatter.formatForChat(message),
      classification: 'refill_trigger',
      model: 'qwen-coder',
      actions_taken: results,
      metadata: {},
    };
  }

  private async handleHealthScoreQuery(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    const context = await this.contextAssembler.assembleFullContext(
      request.patientId,
      'health_score_query',
    );

    const score = context.health_score;

    const message = `Your Health Credit Score is ${score?.current ?? 500}. Your current streak is ${score?.streak_current ?? 0} doses. Your adherence rate is ${context.adherence.weekly?.adherence_rate ?? 0}%.`;

    return {
      message,
      formatted_message: this.responseFormatter.formatForChat(message),
      classification: 'health_score_update',
      model: 'context',
      actions_taken: [],
      metadata: { health_score: score },
    };
  }

  private async handleSeedKnowledge(
    request: AgentEventRequest,
  ): Promise<AgenticResponse> {
    await this.rag.seedDefaultKnowledge();
    const count = await this.rag.getDocumentCount();

    return {
      message: `Medical knowledge base seeded with ${count} documents.`,
      formatted_message: `Medical knowledge base seeded with ${count} documents.`,
      classification: 'simple_chat',
      model: 'system',
      actions_taken: [],
      metadata: { document_count: count },
    };
  }
}
