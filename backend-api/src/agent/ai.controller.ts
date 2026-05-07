import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetPatient } from '../auth/decorator/get-user.decorator';
import { Patient } from '../patient/patient.entity';
import { AiClientService } from './ai-client.service';
import { DoctorAgentService } from './doctor-agent.service';
import { ConfigService } from '@nestjs/config';

class ChatMessageDto {
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;
}

class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsBoolean()
  patient_context?: boolean;
}

class ChatResponseDto {
  message: string;
  model: string;
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(
    private readonly aiClientService: AiClientService,
    private readonly doctorAgentService: DoctorAgentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat with Adheronix AI assistant',
    description:
      'Send messages to the AI assistant for health-related questions. The assistant has access to patient context when patient_context is true.',
  })
  @ApiOkResponse({ type: ChatResponseDto })
  async chat(
    @GetPatient() patient: Patient,
    @Body() body: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const model =
      this.configService.get<string>('OPENROUTER_PRIMARY_MODEL') ??
      'nousresearch/hermes-3-llama-3.1-405b:free';

    let contextMessage = '';
    if (body.patient_context !== false) {
      const context =
        await this.doctorAgentService.buildPatientContext(patient.patient_id);
      contextMessage = `Patient Context (for reference only, do not diagnose): ${JSON.stringify(context)}`;
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are Adheronix AI, a helpful medical adherence assistant. You help patients with medication questions, adherence support, and general health guidance. You are NOT a replacement for a licensed medical professional. Never provide diagnoses. Always advise seeking professional medical help for urgent concerns. Be concise, friendly, and focused on medication adherence.',
      },
      ...(contextMessage ? [{ role: 'system' as const, content: contextMessage }] : []),
      ...body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await this.aiClientService.createChatCompletion({
      model,
      temperature: 0.7,
      max_tokens: 800,
      messages,
    });

    const content =
      response.choices?.[0]?.message?.content?.trim() ??
      'I apologize, but I was unable to process your request. Please try again.';

    return {
      message: content,
      model: response.model ?? model,
    };
  }
}
