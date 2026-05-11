import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './open-router.service';

@Injectable()
export class QwenKinyarwandaService {
  private readonly logger = new Logger(QwenKinyarwandaService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async preprocessKinyarwanda(kinyarwandaText: string): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return this.simpleTranslateToEnglish(kinyarwandaText);
    }

    const model = this.openRouter.getModelConfig(
      'QWEN_KINYARWANDA_MODEL',
      'qwen/qwen3-next-80b-a3b-instruct:free',
    );

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `You are a translator for a Rwandan healthcare app. Translate the following Kinyarwanda text into clear, grammatically correct English medical text. 

Rules:
- Translate medical terms accurately
- Use proper English medical terminology
- Keep all facts and details from the original
- Do not add or remove information
- If medical terms are unclear, use the closest English equivalent

Respond with ONLY the English translation.`,
          },
          {
            role: 'user',
            content: kinyarwandaText,
          },
        ],
        {
          temperature: 0.1,
          max_tokens: 300,
          fallbackModels: ['openrouter/free'],
        },
      );

      return (
        response.choices?.[0]?.message?.content?.trim() ??
        this.simpleTranslateToEnglish(kinyarwandaText)
      );
    } catch (error) {
      this.logger.warn(
        `Kinyarwanda preprocessing failed: ${(error as Error).message}`,
      );
      return this.simpleTranslateToEnglish(kinyarwandaText);
    }
  }

  async postprocessToKinyarwanda(englishText: string): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return englishText;
    }

    const model = this.openRouter.getModelConfig(
      'QWEN_KINYARWANDA_MODEL',
      'qwen/qwen3-next-80b-a3b-instruct:free',
    );

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `Rewrite the following English medical text in natural, conversational Kinyarwanda as a Rwandan community health worker would speak to a rural chronic disease patient.

Rules:
- Keep every medical fact exactly as stated
- Do not add or remove information
- Use warm, plain language
- Do not use technical English loanwords where Kinyarwanda equivalents exist
- Make it sound natural and caring, not like a machine translation

Respond with ONLY the Kinyarwanda text.`,
          },
          {
            role: 'user',
            content: englishText,
          },
        ],
        {
          temperature: 0.7,
          max_tokens: 500,
          fallbackModels: ['openrouter/free'],
        },
      );

      return response.choices?.[0]?.message?.content?.trim() ?? englishText;
    } catch (error) {
      this.logger.warn(
        `Kinyarwanda postprocessing failed: ${(error as Error).message}`,
      );
      return englishText;
    }
  }

  async handleFrenchResponse(englishText: string): Promise<string> {
    if (!this.openRouter.isConfigured()) {
      return englishText;
    }

    const model = this.openRouter.getModelConfig(
      'QWEN_KINYARWANDA_MODEL',
      'qwen/qwen3-next-80b-a3b-instruct:free',
    );

    try {
      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content: `Translate the following English medical text into clear, professional French suitable for a Rwandan patient. Use appropriate medical terminology in French.

Respond with ONLY the French translation.`,
          },
          {
            role: 'user',
            content: englishText,
          },
        ],
        {
          temperature: 0.5,
          max_tokens: 500,
          fallbackModels: ['openrouter/free'],
        },
      );

      return response.choices?.[0]?.message?.content?.trim() ?? englishText;
    } catch (error) {
      this.logger.warn(
        `French translation failed: ${(error as Error).message}`,
      );
      return englishText;
    }
  }

  private simpleTranslateToEnglish(text: string): string {
    const lower = text.toLowerCase();

    if (lower.includes('muraho') || lower.includes('amakuru')) {
      return 'Hello';
    }

    if (lower.includes('umuti') || lower.includes('imiti')) {
      return 'medication';
    }

    if (lower.includes('indwara')) {
      return 'disease';
    }

    if (lower.includes('uburwayi')) {
      return 'illness';
    }

    if (lower.includes('ibitotsi')) {
      return 'sleepiness';
    }

    return text;
  }
}
