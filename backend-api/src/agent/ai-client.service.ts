import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  AgentPatientContext,
  DoctorDecision,
  DoctorToolCall,
  MonitorScreening,
} from './agent.types';

interface ChatCompletionMessage {
  role: string;
  content?: string | null;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  function_call?: {
    name?: string;
    arguments?: string;
  };
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: ChatCompletionMessage;
  }>;
}

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.configService.get<string>('GROQ_API_KEY') ||
        this.configService.get<string>('OPENROUTER_API_KEY'),
    );
  }

  async screenPatientContext(
    context: AgentPatientContext,
  ): Promise<MonitorScreening> {
    const model = this.getModelName('monitor');

    const response = await this.createChatCompletion({
      model,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'You are a medical safety monitoring classifier for a medication adherence app. Review only the provided structured data. Do not diagnose. Return compact JSON only with: escalate boolean, severity one of none/low/medium/high/critical, reasons string array, recommended_action string, confidence number 0-1. Escalate only when the data suggests a meaningful safety, adherence, or urgent-care concern.',
        },
        {
          role: 'user',
          content: JSON.stringify(context),
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = this.parseJsonObject(content ?? '');

    return {
      escalate: Boolean(parsed?.escalate),
      severity: this.normalizeSeverity(parsed?.severity),
      reasons: Array.isArray(parsed?.reasons)
        ? parsed.reasons.map(String).slice(0, 8)
        : [],
      recommended_action:
        typeof parsed?.recommended_action === 'string'
          ? parsed.recommended_action
          : undefined,
      confidence:
        typeof parsed?.confidence === 'number' ? parsed.confidence : undefined,
      model: response.model ?? model,
    };
  }

  async createPrimaryDecision(
    context: AgentPatientContext,
  ): Promise<DoctorDecision> {
    const model = this.getModelName('primary');

    const response = await this.createChatCompletion({
      model,
      temperature: 0,
      max_tokens: 900,
      tools: this.getDoctorTools(),
      tool_choice: 'auto',
      messages: [
        {
          role: 'system',
          content:
            'You are the primary safety triage engine for a medication adherence app. You are not a replacement for a licensed clinician and must not provide a diagnosis. Use the available tools only for safety triage, adherence support, and human review escalation. Prefer requestHumanReview for uncertain critical cases. Use callEmergencySupport only when the supplied data suggests an immediate life-threatening risk. If no action is needed, return no tool calls. Keep patient-facing text calm, brief, and action-oriented.',
        },
        {
          role: 'user',
          content:
            'Evaluate this patient context and choose zero to three tool calls. If native tool calls are unavailable, return JSON as {"tool_calls":[{"name":"notifyPatient","arguments":{...}}]}.\n\n' +
            JSON.stringify(context),
        },
      ],
    });

    const message = response.choices?.[0]?.message;

    return {
      model: response.model ?? model,
      content: message?.content ?? undefined,
      toolCalls: this.normalizeToolCalls(message),
      raw: response,
    };
  }

  async createChatCompletion(
    body: Record<string, unknown>,
  ): Promise<ChatCompletionResponse> {
    const provider = this.getProvider();
    const apiKey = provider.apiKey;
    if (!apiKey) {
      throw new Error(`${provider.keyName} is not configured`);
    }

    const baseUrl = provider.baseUrl;
    const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const timeoutMs = Number(
      this.configService.get<string>('AGENT_LLM_TIMEOUT_MS') ?? 30000,
    );

    const requestedModel =
      typeof body.model === 'string' ? body.model : undefined;
    const fallbackModels = [
      requestedModel,
      ...provider.models,
    ].filter((model, index, models): model is string =>
      Boolean(model) && models.indexOf(model) === index,
    );

    let lastError: Error | null = null;

    for (const model of fallbackModels) {
      try {
        const response = await axios.post<ChatCompletionResponse>(
          endpoint,
          { ...body, model },
          {
            headers: this.getHeaders(apiKey, provider.name),
            timeout: timeoutMs,
            family: 4, // Force IPv4 to avoid IPv6 timeout issues
          },
        );

        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorBody = error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message;

          if (status === 429) {
            this.logger.warn(
              `Model ${model} rate-limited, trying next fallback...`,
            );
            lastError = error;
            continue;
          }

          throw new Error(
              `${provider.name} request failed with ${status}: ${errorBody}`,
          );
        }
        throw error;
      }
    }

    this.logger.error(
      `All fallback models failed. Last error: ${(lastError as Error).message}`,
    );
    throw lastError ?? new Error('All fallback models failed');
  }

  private getProvider() {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    if (groqApiKey) {
      return {
        name: 'Groq',
        keyName: 'GROQ_API_KEY',
        apiKey: groqApiKey,
        baseUrl:
          this.configService.get<string>('GROQ_BASE_URL') ??
          'https://api.groq.com/openai/v1',
        models: [
          this.configService.get<string>('GROQ_PRIMARY_MODEL') ??
            'llama-3.3-70b-versatile',
          this.configService.get<string>('GROQ_MONITOR_MODEL') ??
            'llama-3.1-8b-instant',
        ],
      };
    }

    return {
      name: 'OpenRouter',
      keyName: 'OPENROUTER_API_KEY',
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
      baseUrl:
        this.configService.get<string>('OPENROUTER_BASE_URL') ??
        'https://openrouter.ai/api/v1',
      models: [
        this.configService.get<string>('OPENROUTER_PRIMARY_MODEL') ??
          'baidu/cobuddy:free',
        'baidu/cobuddy:free',
        'poolside/laguna-xs.2:free',
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      ],
    };
  }

  private getModelName(kind: 'primary' | 'monitor') {
    if (this.configService.get<string>('GROQ_API_KEY')) {
      return kind === 'primary'
        ? (this.configService.get<string>('GROQ_PRIMARY_MODEL') ??
            'llama-3.3-70b-versatile')
        : (this.configService.get<string>('GROQ_MONITOR_MODEL') ??
            'llama-3.1-8b-instant');
    }

    return kind === 'primary'
      ? (this.configService.get<string>('OPENROUTER_PRIMARY_MODEL') ??
          'baidu/cobuddy:free')
      : (this.configService.get<string>('OPENROUTER_MONITOR_MODEL') ??
          'qwen/qwen3-next-80b-a3b-instruct:free');
  }

  private getHeaders(apiKey: string, providerName: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (providerName === 'Groq') {
      return headers;
    }

    const referer = this.configService.get<string>('OPENROUTER_HTTP_REFERER');
    const title =
      this.configService.get<string>('OPENROUTER_APP_TITLE') ?? 'AdheronixApp';

    if (referer) {
      headers['HTTP-Referer'] = referer;
    }

    if (title) {
      headers['X-Title'] = title;
    }

    return headers;
  }

  private getDoctorTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'notifyPatient',
          description:
            'Send a patient-facing medication safety or adherence notification.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              message: { type: 'string' },
              severity: {
                type: 'string',
                enum: ['info', 'warning', 'critical'],
              },
              rationale: { type: 'string' },
            },
            required: ['title', 'message', 'severity', 'rationale'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'alertEmergencyContact',
          description:
            'Flag that the patient emergency contact should be alerted. The backend may route this through a configured webhook, otherwise it creates an internal safety notification.',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              severity: {
                type: 'string',
                enum: ['warning', 'critical'],
              },
              rationale: { type: 'string' },
            },
            required: ['message', 'severity', 'rationale'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'requestHumanReview',
          description:
            'Create a clinical/admin review flag when automated action is uncertain or too risky.',
          parameters: {
            type: 'object',
            properties: {
              priority: {
                type: 'string',
                enum: ['routine', 'urgent', 'emergency'],
              },
              summary: { type: 'string' },
              rationale: { type: 'string' },
            },
            required: ['priority', 'summary', 'rationale'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'callEmergencySupport',
          description:
            'Request emergency support for immediate life-threatening risk. The backend will only place an outbound emergency webhook if explicitly enabled and configured.',
          parameters: {
            type: 'object',
            properties: {
              reason: { type: 'string' },
              observedRisk: { type: 'string' },
              instructions: { type: 'string' },
            },
            required: ['reason', 'observedRisk'],
          },
        },
      },
    ];
  }

  private normalizeToolCalls(
    message?: ChatCompletionMessage,
  ): DoctorToolCall[] {
    const calls: DoctorToolCall[] = [];

    for (const call of message?.tool_calls ?? []) {
      const name = call.function?.name;
      if (!name) {
        continue;
      }

      calls.push({
        name,
        arguments: this.parseArguments(call.function?.arguments),
        raw: call,
      });
    }

    if (message?.function_call?.name) {
      calls.push({
        name: message.function_call.name,
        arguments: this.parseArguments(message.function_call.arguments),
        raw: message.function_call,
      });
    }

    if (calls.length > 0 || !message?.content) {
      return calls;
    }

    const parsed = this.parseJsonObject(message.content);
    const contentCalls = Array.isArray(parsed?.tool_calls)
      ? parsed.tool_calls
      : Array.isArray(parsed?.actions)
        ? parsed.actions
        : parsed?.name
          ? [parsed]
          : [];

    for (const call of contentCalls) {
      if (!call?.name) {
        continue;
      }

      calls.push({
        name: String(call.name),
        arguments: this.parseArguments(call.arguments ?? call.args ?? {}),
        raw: call,
      });
    }

    return calls;
  }

  private parseArguments(value: unknown): Record<string, unknown> {
    if (!value) {
      return {};
    }

    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    if (typeof value !== 'string') {
      return {};
    }

    const parsed = this.parseJsonObject(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  private parseJsonObject(value: string): Record<string, unknown> | null {
    const content = value.trim();
    if (!content) {
      return null;
    }

    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? content;

    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return null;
      }

      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  private normalizeSeverity(value: unknown): MonitorScreening['severity'] {
    if (
      value === 'low' ||
      value === 'medium' ||
      value === 'high' ||
      value === 'critical' ||
      value === 'none'
    ) {
      return value;
    }

    return 'none';
  }
}
