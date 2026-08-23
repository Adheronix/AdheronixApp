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

    // Count indicators only when they appear as whole words/phrases to avoid
    // false positives from English words containing short substrings (e.g. "i" inside "hi").
    const countIndicators = (indicators: string[]) =>
      indicators.filter((indicator) => {
        const escaped = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern =
          indicator.includes(' ') || indicator.length > 2
            ? `(?:^|[^a-zÀ-ÿ])${escaped}(?:[^a-zÀ-ÿ]|$)`
            : `\\b${escaped}\\b`;
        return new RegExp(pattern, 'i').test(lowerText);
      }).length;

    const frenchScore = countIndicators(frenchIndicators);

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

    const kinyarwandaScore = countIndicators(kinyarwandaIndicators);

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
      const model = this.openRouter.resolveModel(
        'LANG_DETECT_MODEL',
        'meta-llama/llama-3.2-3b-instruct:free',
        'llama-3.1-8b-instant',
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
