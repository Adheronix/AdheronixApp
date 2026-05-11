import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OCRExtractionResult } from './agent.types';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly configService: ConfigService) {}

  async extractPrescription(imageBase64: string): Promise<OCRExtractionResult> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (
      apiKey &&
      this.configService.get<string>('OCR_USE_OPENROUTER') === 'true'
    ) {
      return this.extractViaOpenRouter(imageBase64);
    }

    return this.extractViaDirectOCR(imageBase64);
  }

  private async extractViaOpenRouter(
    imageBase64: string,
  ): Promise<OCRExtractionResult> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const baseUrl =
      this.configService.get<string>('OPENROUTER_BASE_URL') ??
      'https://openrouter.ai/api/v1';

    const model =
      this.configService.get<string>('OCR_MODEL') ??
      'baidu/qianfan-ocr-fast:free';

    try {
      const response = await axios.post(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this prescription image. Then format the extracted text as a JSON array of medications with fields: name, dosage, frequency, duration, instructions. Return ONLY the JSON array.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              this.configService.get<string>('OPENROUTER_HTTP_REFERER') ?? '',
            'X-Title':
              this.configService.get<string>('OPENROUTER_APP_TITLE') ??
              'AdheronixApp',
          },
          timeout: 30000,
          family: 4,
        },
      );

      const content = response.data?.choices?.[0]?.message?.content ?? '';

      return this.parseOcrResponse(content);
    } catch (error) {
      this.logger.error(`OpenRouter OCR failed: ${(error as Error).message}`);
      return this.extractViaDirectOCR(imageBase64);
    }
  }

  private async extractViaDirectOCR(
    imageBase64: string,
  ): Promise<OCRExtractionResult> {
    const ocrApiKey = this.configService.get<string>('BAIDU_OCR_API_KEY');

    if (!ocrApiKey) {
      return {
        medications: [],
        raw_text: '',
        confidence: 0,
      };
    }

    try {
      const tokenResponse = await axios.get(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${ocrApiKey}&client_secret=${this.configService.get<string>('BAIDU_OCR_SECRET_KEY')}`,
      );

      const accessToken = tokenResponse.data.access_token;

      const response = await axios.post(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`,
        `image=${encodeURIComponent(imageBase64)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        },
      );

      const rawText =
        response.data.words_result?.map((item: any) => item.words).join('\n') ??
        '';

      return {
        medications: this.extractMedicationsFromText(rawText),
        raw_text: rawText,
        confidence: response.data.words_result_num ?? 0,
      };
    } catch (error) {
      this.logger.error(`Baidu OCR failed: ${(error as Error).message}`);
      return {
        medications: [],
        raw_text: '',
        confidence: 0,
      };
    }
  }

  private parseOcrResponse(content: string): OCRExtractionResult {
    const trimmed = content.trim();

    try {
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
      const jsonStr = fenced ?? trimmed;
      const medications = JSON.parse(jsonStr);

      if (Array.isArray(medications)) {
        return {
          medications,
          raw_text: content,
          confidence: 0.9,
        };
      }
    } catch {
      // Fall through to text extraction
    }

    return {
      medications: this.extractMedicationsFromText(content),
      raw_text: content,
      confidence: 0.5,
    };
  }

  private extractMedicationsFromText(
    text: string,
  ): OCRExtractionResult['medications'] {
    const medications: OCRExtractionResult['medications'] = [];
    const lines = text.split('\n').filter((line) => line.trim());

    let currentMed: Partial<(typeof medications)[0]> = {};

    for (const line of lines) {
      const trimmed = line.trim();

      const nameMatch = trimmed.match(
        /^(?:medicine|drug|medication|pill|tablet|capsule)?\s*:?\s*([A-Z][a-zA-Z\s]+(?:\s+\d+(?:mg|ml|mcg))?)/i,
      );

      const dosageMatch = trimmed.match(
        /(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|units?)/i,
      );
      const freqMatch =
        trimmed.match(/(\d+)\s*x\s*(daily|day|week|daily|times?|per\s*day)/i) ||
        trimmed.match(/(once|twice|thrice)\s*(daily|a\s*day)/i);
      const durationMatch = trimmed.match(/(\d+)\s*(days?|weeks?|months?)/i);

      if (nameMatch) {
        if (currentMed.name) {
          medications.push(currentMed as any);
        }
        currentMed = { name: nameMatch[1].trim() };
      }

      if (dosageMatch && !currentMed.dosage) {
        currentMed.dosage = `${dosageMatch[1]} ${dosageMatch[2]}`;
      }

      if (freqMatch && !currentMed.frequency) {
        currentMed.frequency = freqMatch[0];
      }

      if (durationMatch && !currentMed.duration) {
        currentMed.duration = `${durationMatch[1]} ${durationMatch[2]}`;
      }
    }

    if (currentMed.name) {
      medications.push(currentMed as any);
    }

    return medications;
  }
}
