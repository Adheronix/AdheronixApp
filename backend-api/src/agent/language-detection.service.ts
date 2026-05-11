import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './open-router.service';
import { DetectedLanguage } from './agent.types';

@Injectable()
export class LanguageDetectionService {
  private readonly logger = new Logger(LanguageDetectionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async detectLanguage(text: string): Promise<DetectedLanguage> {
    if (!text || text.trim().length === 0) {
      return 'english';
    }

    const trimmed = text.trim();

    if (trimmed.length < 3) {
      return 'english';
    }

    const frenchIndicators = [
      'je',
      'tu',
      'il',
      'elle',
      'nous',
      'vous',
      'ils',
      'elles',
      'suis',
      'est',
      'sont',
      'avons',
      'avez',
      'ont',
      'le',
      'la',
      'les',
      'un',
      'une',
      'des',
      'du',
      'de',
      'et',
      'ou',
      'mais',
      'donc',
      'parce que',
      'comment',
      'pourquoi',
      'quand',
      'où',
      'quel',
      'médicament',
      'médecin',
      'santé',
      'douleur',
      'malade',
    ];

    const lowerText = trimmed.toLowerCase();
    const frenchScore = frenchIndicators.filter((word) =>
      lowerText.includes(word),
    ).length;

    const kinyarwandaIndicators = [
      'ni',
      'ye',
      'uri',
      'ari',
      'turi',
      'muri',
      'buri',
      'ndi',
      'ur',
      'mw',
      'ku',
      'mu',
      'i',
      'none',
      'ese',
      'se',
      'ngwino',
      'reka',
      'ubuzima',
      'umuti',
      'indwara',
      'ibiro',
      'amafaranga',
      'meze',
      'neza',
      'nabi',
      'gukora',
      'kurya',
      'muraho',
      'amakuru',
      'wameze',
      'ute',
      'mwene',
    ];

    const kinyarwandaScore = kinyarwandaIndicators.filter((word) =>
      lowerText.includes(word),
    ).length;

    if (
      kinyarwandaScore >= 2 ||
      (kinyarwandaScore > frenchScore && kinyarwandaScore > 0)
    ) {
      return 'kinyarwanda';
    }

    if (frenchScore >= 2 && frenchScore > kinyarwandaScore) {
      return 'french';
    }

    if (frenchScore >= 1 && trimmed.length < 20) {
      return 'french';
    }

    if (!this.openRouter.isConfigured()) {
      return 'english';
    }

    try {
      const model = this.openRouter.getModelConfig(
        'LANG_DETECT_MODEL',
        'meta-llama/llama-3.2-3b-instruct:free',
      );

      const response = await this.openRouter.chatCompletion(
        model,
        [
          {
            role: 'system',
            content:
              'Classify the language of the following text. Respond with only one word: english, french, or kinyarwanda.',
          },
          {
            role: 'user',
            content: trimmed,
          },
        ],
        {
          temperature: 0,
          max_tokens: 10,
          fallbackModels: ['openrouter/free'],
        },
      );

      const content =
        response.choices?.[0]?.message?.content?.trim().toLowerCase() ??
        'english';

      if (
        content.includes('kinyarwanda') ||
        content.includes('rwanda') ||
        content.includes('kinya')
      ) {
        return 'kinyarwanda';
      }

      if (
        content.includes('french') ||
        content.includes('français') ||
        content.includes('fr')
      ) {
        return 'french';
      }

      return 'english';
    } catch (error) {
      this.logger.warn(
        `Language detection model failed, falling back to heuristic: ${(error as Error).message}`,
      );

      if (kinyarwandaScore > 0) return 'kinyarwanda';
      if (frenchScore > 0) return 'french';
      return 'english';
    }
  }
}
