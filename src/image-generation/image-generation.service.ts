import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality } from '@google/genai';
import { GenerateImageDto } from './dto/generate-image.dto';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  prompt: string;
  revisedPrompt?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  geminiApi: {
    connected: boolean;
    responseTimeMs?: number;
    error?: string;
  };
  timestamp: string;
}

@Injectable()
export class ImageGenerationService {
  private genAI: GoogleGenAI;
  private readonly outputDir: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not configured');
    }
    this.genAI = new GoogleGenAI({ apiKey });
    this.outputDir = path.join(process.cwd(), 'generated-images');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateAnimeIllustration(dto: GenerateImageDto): Promise<GeneratedImage> {
    const enhancedPrompt = this.buildAnimePrompt(dto);

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: enhancedPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        throw new HttpException(
          'No image generated from the API',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      let imageData: { base64: string; mimeType: string } | null = null;
      let textResponse: string | undefined;

      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
        if (part.text) {
          textResponse = part.text;
        }
      }

      if (!imageData) {
        throw new HttpException(
          'No image data in response',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        base64: imageData.base64,
        mimeType: imageData.mimeType,
        prompt: enhancedPrompt,
        revisedPrompt: textResponse,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to generate image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateAndSave(dto: GenerateImageDto): Promise<{ filePath: string; url: string }> {
    const result = await this.generateAnimeIllustration(dto);

    const timestamp = Date.now();
    const extension = result.mimeType.split('/')[1] || 'png';
    const filename = `anime_${timestamp}.${extension}`;
    const filePath = path.join(this.outputDir, filename);

    const buffer = Buffer.from(result.base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    return {
      filePath,
      url: `/images/${filename}`,
    };
  }

  private buildAnimePrompt(dto: GenerateImageDto): string {
    const basePrompt = `Create a high-quality anime illustration: ${dto.prompt}`;
    const styleModifier = dto.style ? `, ${dto.style}` : ', modern anime style';
    const qualityTags = ', highly detailed, vibrant colors, professional artwork, 4k quality';

    let fullPrompt = `${basePrompt}${styleModifier}${qualityTags}`;

    if (dto.negativePrompt) {
      fullPrompt += `. Avoid: ${dto.negativePrompt}`;
    }

    return fullPrompt;
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'Say "ok" in one word.',
      });

      const responseTimeMs = Date.now() - startTime;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        return {
          status: 'healthy',
          geminiApi: {
            connected: true,
            responseTimeMs,
          },
          timestamp,
        };
      }

      return {
        status: 'unhealthy',
        geminiApi: {
          connected: false,
          responseTimeMs,
          error: 'No response from API',
        },
        timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        geminiApi: {
          connected: false,
          responseTimeMs: Date.now() - startTime,
          error: error.message,
        },
        timestamp,
      };
    }
  }
}
