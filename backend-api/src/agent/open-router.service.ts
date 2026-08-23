import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { ChatMessage } from './agent.types';

interface ChatCompletionChoice {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: Array<{
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  finish_reason?: string;
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface EmbeddingResponse {
  model?: string;
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly requestCounts = new Map<string, number>();
  private readonly dailyReset = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('GROQ_API_KEY') ||
        this.configService.get<string>('OPENROUTER_API_KEY'),
    );
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
      tools?: Array<Record<string, unknown>>;
      tool_choice?: string;
      response_format?: { type: string };
      fallbackModels?: string[];
    } = {},
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

    const fallbackChain = [
      model,
      ...(options.fallbackModels ?? []),
      'openrouter/free',
    ].filter(Boolean);

    let lastError: Error | null = null;

    for (const candidateModel of fallbackChain) {
      try {
        const body: Record<string, unknown> = {
          model: candidateModel,
          messages,
          temperature: options.temperature ?? 0,
          max_tokens: options.max_tokens ?? 1000,
        };

        if (options.tools && options.tools.length > 0) {
          body.tools = options.tools;
          body.tool_choice = options.tool_choice ?? 'auto';
        }

        if (options.response_format) {
          body.response_format = options.response_format;
        }

        const response = await axios.post<ChatCompletionResponse>(
          endpoint,
          body,
          {
            headers: this.getHeaders(apiKey, provider.name),
            timeout: timeoutMs,
            family: 4,
          },
        );

        this.logUsage(candidateModel, response.data);
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          if (status === 429) {
            this.logger.warn(
              `Model ${candidateModel} rate-limited, trying next fallback...`,
            );
            lastError = error;
            continue;
          }

          if (status === 402 || status === 401) {
            this.logger.warn(
              `Model ${candidateModel} returned ${status}, trying next fallback...`,
            );
            lastError = error;
            continue;
          }

          throw new Error(
            `${provider.name} request to ${candidateModel} failed with ${status}: ${this.extractErrorMessage(error)}`,
          );
        }
        throw error;
      }
    }

    throw lastError ?? new Error('All fallback models failed');
  }

  async createEmbedding(
    model: string,
    input: string | string[],
    options: { fallbackModels?: string[] } = {},
  ): Promise<EmbeddingResponse> {
    const provider = this.getProvider();
    const apiKey = provider.apiKey;
    if (!apiKey) {
      throw new Error(`${provider.keyName} is not configured`);
    }

    const baseUrl = provider.baseUrl;
    const endpoint = `${baseUrl.replace(/\/$/, '')}/embeddings`;
    const timeoutMs = Number(
      this.configService.get<string>('AGENT_LLM_TIMEOUT_MS') ?? 30000,
    );

    const fallbackChain = [model, ...(options.fallbackModels ?? [])].filter(
      Boolean,
    );
    let lastError: Error | null = null;

    for (const candidateModel of fallbackChain) {
      try {
        const response = await axios.post<EmbeddingResponse>(
          endpoint,
          {
            model: candidateModel,
            input,
          },
          {
            headers: this.getHeaders(apiKey, provider.name),
            timeout: timeoutMs,
            family: 4,
          },
        );

        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          if (status === 429 || status === 402 || status === 401) {
            lastError = error;
            continue;
          }

          throw new Error(
              `${provider.name} embedding request failed with ${status}: ${this.extractErrorMessage(error)}`,
          );
        }
        throw error;
      }
    }

    throw lastError ?? new Error('All embedding fallback models failed');
  }

  getModelConfig(key: string, defaultModel: string): string {
    return this.configService.get<string>(key) ?? defaultModel;
  }

  /**
   * Resolves a model name that is appropriate for the configured provider.
   * Use this when the caller supplies provider-specific defaults.
   */
  resolveModel(
    key: string,
    openRouterDefault: string,
    groqDefault: string,
  ): string {
    const configured = this.configService.get<string>(key);
    if (configured) {
      return configured;
    }

    if (this.configService.get<string>('GROQ_API_KEY')) {
      return groqDefault;
    }

    return openRouterDefault;
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
      };
    }

    return {
      name: 'OpenRouter',
      keyName: 'OPENROUTER_API_KEY',
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
      baseUrl:
        this.configService.get<string>('OPENROUTER_BASE_URL') ??
        'https://openrouter.ai/api/v1',
    };
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

  private logUsage(model: string, response: ChatCompletionResponse) {
    if (response.usage) {
      this.logger.debug(
        `Model ${model}: prompt=${response.usage.prompt_tokens}, completion=${response.usage.completion_tokens}, total=${response.usage.total_tokens}`,
      );
    }
  }

  private extractErrorMessage(error: AxiosError): string {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'error' in data) {
      const err = data.error as Record<string, unknown>;
      return typeof err.message === 'string'
        ? err.message
        : JSON.stringify(data);
    }
    return error.message;
  }

  parseJsonObject(value: string): Record<string, unknown> | null {
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
}
