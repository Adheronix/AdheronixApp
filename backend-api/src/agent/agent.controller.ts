import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetPatient } from '../auth/decorator/get-user.decorator';
import { Patient } from '../patient/patient.entity';
import { EventRouterService, AgentEventRequest } from './event-router.service';
import { ResponseFormatterService } from './response-formatter.service';
import { DoctorAgentService } from './doctor-agent.service';
import { RagService } from './rag.service';
import { OcrService } from './ocr.service';

class ChatMessageDto {
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;
}

class ChatRequestDto {
  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  @IsOptional()
  @IsString()
  image_data?: string;
}

class EventResponseDto {
  message: string;
  formatted_message: string;
  classification: string;
  model: string;
  actions_taken: Array<{
    tool: string;
    status: string;
    result: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
}

@ApiTags('agent')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('agent')
export class AgentController {
  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly responseFormatter: ResponseFormatterService,
    private readonly doctorAgent: DoctorAgentService,
    private readonly rag: RagService,
    private readonly ocr: OcrService,
  ) {}

  @Post('event')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a patient event to the agentic system',
    description:
      'Unified endpoint for all patient-side events: chat messages, dose actions, OCR scans, dashboard loads, etc.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async handleEvent(
    @GetPatient() patient: Patient,
    @Body() body: ChatRequestDto,
  ): Promise<EventResponseDto> {
    const eventType = body.event_type ?? 'chat';

    if (eventType === 'chat' && !body.message) {
      throw new BadRequestException('Message is required for chat events');
    }

    const request: AgentEventRequest = {
      patientId: patient.patient_id,
      eventType,
      userMessage: body.message,
      conversationHistory:
        body.history?.map((h) => ({
          role: h.role,
          content: h.content,
        })) ?? [],
      imageData: body.image_data,
    };

    const response = await this.eventRouter.handleEvent(request);

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat with Adheronix AI assistant',
    description:
      'Send messages to the AI assistant. The assistant routes through the full agentic pipeline for intelligent responses.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async chat(
    @GetPatient() patient: Patient,
    @Body() body: ChatRequestDto,
  ): Promise<EventResponseDto> {
    if (!body.message) {
      throw new BadRequestException('Message is required');
    }

    const request: AgentEventRequest = {
      patientId: patient.patient_id,
      eventType: 'chat',
      userMessage: body.message,
      conversationHistory:
        body.history?.map((h) => ({
          role: h.role,
          content: h.content,
        })) ?? [],
    };

    const response = await this.eventRouter.handleEvent(request);

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Load dashboard with AI-generated greeting',
    description:
      'Triggers the dashboard load flow with personalized greeting and live data.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async loadDashboard(
    @GetPatient() patient: Patient,
  ): Promise<EventResponseDto> {
    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'dashboard_load',
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('dose/taken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark dose as taken',
    description:
      'Records a dose as taken and triggers the full agentic response (health score update, encouragement).',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async markDoseTaken(
    @GetPatient() patient: Patient,
  ): Promise<EventResponseDto> {
    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'dose_taken',
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('dose/missed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report missed dose',
    description:
      'Reports a missed dose and triggers the agentic missed dose reasoning pipeline.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async reportMissedDose(
    @GetPatient() patient: Patient,
  ): Promise<EventResponseDto> {
    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'missed_dose',
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('ocr/scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a prescription image',
    description:
      'Upload a prescription photo for OCR extraction and DDI verification.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async scanPrescription(
    @GetPatient() patient: Patient,
    @Body() body: ChatRequestDto,
  ): Promise<EventResponseDto> {
    if (!body.image_data) {
      throw new BadRequestException('Image data is required for OCR scanning');
    }

    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'ocr_scan',
      imageData: body.image_data,
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('refill/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger medication refill',
    description: 'Initiates the refill process for the patient.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async triggerRefill(
    @GetPatient() patient: Patient,
  ): Promise<EventResponseDto> {
    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'refill_trigger',
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('health-score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current health score',
    description: 'Returns the patient current Health Credit Score.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async getHealthScore(
    @GetPatient() patient: Patient,
  ): Promise<EventResponseDto> {
    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'health_score_query',
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }

  @Post('knowledge/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed medical knowledge base',
    description: 'Seeds the RAG medical knowledge base with default documents.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  async seedKnowledge(
    @GetPatient() patient: Patient,
  ): Promise<EventResponseDto> {
    const response = await this.eventRouter.handleEvent({
      patientId: patient.patient_id,
      eventType: 'seed_knowledge',
    });

    return {
      message: response.message,
      formatted_message: response.formatted_message,
      classification: response.classification,
      model: response.model,
      actions_taken: response.actions_taken,
      metadata: response.metadata,
    };
  }
}
