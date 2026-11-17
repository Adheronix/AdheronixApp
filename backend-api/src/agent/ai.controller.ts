import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  MaxLength,
  ValidateNested,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetPatient } from '../auth/decorator/get-user.decorator';
import { Patient } from '../patient/patient.entity';
import { AiClientService } from './ai-client.service';
import { DoctorAgentService } from './doctor-agent.service';
import { ConfigService } from '@nestjs/config';
import {
  CARE_SCOPE_REPLY,
  CARE_SYSTEM_PROMPT,
  chatIntent,
} from './ai-chat-policy';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content: string;
}

class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsBoolean()
  patient_context?: boolean;
}

class ChatResponseDto {
  message: string;
  model: string | null;
  provider: string | null;
  response_kind: 'care' | 'scope' | 'identity';
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
      this.configService.get<string>('GROQ_PRIMARY_MODEL') ??
      this.configService.get<string>('OPENROUTER_PRIMARY_MODEL') ??
      'openai/gpt-oss-20b';

    const latest = body.messages.at(-1);
    if (!latest || latest.role !== 'user' || !latest.content.trim()) {
      throw new BadRequestException(
        'End the conversation with a non-empty user message.',
      );
    }
    const intent = chatIntent(latest.content);
    if (intent === 'coding')
      return {
        message: CARE_SCOPE_REPLY,
        model: null,
        provider: null,
        response_kind: 'scope',
      };
    if (intent === 'identity') {
      // A tiny context-free request verifies the actual selected provider/fallback.
      // The model's self-description is never used as identity evidence.
      try {
        const actual = await this.aiClientService.createChatCompletion({
          model,
          temperature: 0,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Reply OK.' }],
        });
        return {
          message: actual.model
            ? `I’m the Adheronix care assistant. This runtime check used **${actual.model}**${actual.provider ? ` through **${actual.provider}**` : ''}. Routing can change between requests; this does not identify earlier replies. I shouldn’t have guessed GPT-4 or called any model “the latest.”`
            : 'I’m the Adheronix care assistant. The provider did not report a model identifier, so I can’t verify the exact model.',
          model: actual.model ?? null,
          provider: actual.provider ?? null,
          response_kind: 'identity',
        };
      } catch {
        return {
          message:
            'I’m the Adheronix care assistant. I can’t verify the runtime model right now, so I won’t guess its name or version.',
          model: null,
          provider: null,
          response_kind: 'identity',
        };
      }
    }
    let contextMessage = '';
    if (body.patient_context === true) {
      const context = await this.doctorAgentService.buildPatientContext(
        patient.patient_id,
      );
      contextMessage = `Patient Context (for reference only, do not diagnose): ${JSON.stringify(context)}`;
    }

    const messages = [
      {
        role: 'system',
        content: CARE_SYSTEM_PROMPT,
      },
      ...(contextMessage
        ? [{ role: 'system' as const, content: contextMessage }]
        : []),
      ...body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await this.aiClientService
      .createChatCompletion({
        model,
        temperature: 0.3,
        max_tokens: 800,
        messages,
      })
      .catch(() => {
        throw new ServiceUnavailableException(
          'The AI assistant is temporarily unavailable. Please try again later.',
        );
      });

    const content =
      response.choices?.[0]?.message?.content?.trim() ??
      'I apologize, but I was unable to process your request. Please try again.';

    return {
      message: content,
      model: response.model ?? null,
      provider: response.provider ?? null,
      response_kind: 'care',
    };
  }
}
